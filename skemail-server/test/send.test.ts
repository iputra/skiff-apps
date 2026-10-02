import { describe, expect, it } from 'vitest';
import { decryptSessionKey, decryptSymmetric } from 'skiff-crypto';

import {
  addUser,
  clientOperation,
  createTestEnv,
  encryptedMessage,
  run,
  TestEnv,
  TestUser,
  TextDatagram
} from './helpers';

const inbox = async (env: TestEnv, user: TestUser, label: string) => {
  const { data, errors } = await run(env, clientOperation('mailbox'), { request: { label, limit: 20 } }, user.row);
  expect(errors).toBeUndefined();
  return data!.mailbox.threads as any[];
};

const readSubject = (user: TestUser, email: any) => {
  const sessionKey = decryptSessionKey(
    email.encryptedSessionKey.encryptedSessionKey,
    user.privateUserData.privateKey,
    email.encryptedSessionKey.encryptedBy
  );
  return decryptSymmetric(email.encryptedSubject.encryptedData, sessionKey, TextDatagram).text;
};

describe('sending between local users', () => {
  it('delivers to the recipient inbox and the sender SENT, and replies extend the thread', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');

    const sent = await run(
      env,
      clientOperation('sendMessage'),
      { request: encryptedMessage(alice, [bob], 'Hi Bob', 'First') },
      alice.row
    );
    expect(sent.errors).toBeUndefined();
    const { threadID, messageID } = sent.data!.sendMessage;

    const bobInbox = await inbox(env, bob, 'INBOX');
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0].threadID).toBe(threadID);
    expect(bobInbox[0].attributes.read).toBe(false);
    expect(readSubject(bob, bobInbox[0].emails[0])).toBe('Hi Bob');

    const aliceSent = await inbox(env, alice, 'SENT');
    expect(aliceSent.map((t) => t.threadID)).toEqual([threadID]);
    expect(readSubject(alice, aliceSent[0].emails[0])).toBe('Hi Bob');
    expect(await inbox(env, alice, 'INBOX')).toHaveLength(0);

    const unread = await run(env, clientOperation('getNumUnread'), { label: 'INBOX' }, bob.row);
    expect(unread.data!.unread).toBe(1);

    const reply = await run(
      env,
      clientOperation('sendReplyMessage'),
      { request: { ...encryptedMessage(bob, [alice], 'Re: Hi Bob', 'Second'), replyID: messageID } },
      bob.row
    );
    expect(reply.errors).toBeUndefined();
    expect(reply.data!.replyToMessage.threadID).toBe(threadID);

    for (const user of [alice, bob]) {
      const { data } = await run(env, clientOperation('getThreadFromID'), { threadID }, user.row);
      expect(data!.userThread.emails.map((e: any) => readSubject(user, e))).toEqual(['Hi Bob', 'Re: Hi Bob']);
    }
    // The reply lands in Alice's inbox on the same thread, unread.
    const aliceInbox = await inbox(env, alice, 'INBOX');
    expect(aliceInbox.map((t) => t.threadID)).toEqual([threadID]);
    expect(aliceInbox[0].attributes.read).toBe(false);
  });

  it('moves threads between mailboxes and tracks read state', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');
    const sent = await run(
      env,
      clientOperation('sendMessage'),
      { request: encryptedMessage(alice, [bob], 'S', 'B') },
      alice.row
    );
    const { threadID } = sent.data!.sendMessage;

    await run(env, clientOperation('setReadStatus'), { request: { threadIDs: [threadID], read: true } }, bob.row);
    expect((await inbox(env, bob, 'INBOX'))[0].attributes.read).toBe(true);

    const trashed = await run(
      env,
      clientOperation('applyLabels'),
      { request: { threadIDs: [threadID], systemLabels: ['TRASH'] } },
      bob.row
    );
    expect(trashed.errors).toBeUndefined();
    expect(await inbox(env, bob, 'INBOX')).toHaveLength(0);
    expect(await inbox(env, bob, 'TRASH')).toHaveLength(1);
    // Alice's copy is unaffected.
    expect(await inbox(env, alice, 'SENT')).toHaveLength(1);
  });

  it('hands each received thread to the client mail filters once, until a new email arrives', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');
    const unfiltered = async (user: TestUser) =>
      (
        await run(
          env,
          clientOperation('mailboxWithContent'),
          { request: { clientsideFiltersApplied: false, limit: 50 } },
          user.row
        )
      ).data!.mailbox.threads.map((t: any) => t.threadID);

    const sent = await run(
      env,
      clientOperation('sendMessage'),
      { request: encryptedMessage(alice, [bob], 'S', 'B') },
      alice.row
    );
    const { threadID, messageID } = sent.data!.sendMessage;
    expect(await unfiltered(bob)).toEqual([threadID]);
    expect(await unfiltered(alice)).toEqual([]);

    await run(env, clientOperation('markThreadsAsClientsideFiltered'), { request: { threadIDs: [threadID] } }, bob.row);
    expect(await unfiltered(bob)).toEqual([]);

    await run(
      env,
      clientOperation('sendReplyMessage'),
      { request: { ...encryptedMessage(alice, [bob], 'Re', 'B2'), replyID: messageID } },
      alice.row
    );
    expect(await unfiltered(bob)).toEqual([threadID]);
  });

  it('refuses to send from an address the user does not own', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');
    const message = { ...encryptedMessage(alice, [bob], 'S', 'B'), from: { address: 'bob@skiff.local' } };
    const result = await run(env, clientOperation('sendMessage'), { request: message }, alice.row);
    expect(result.errors?.[0].message).toMatch(/cannot send from/);
  });
});
