import { describe, expect, it } from 'vitest';

import { addUser, clientOperation, createTestEnv, encryptedMessage, run } from './helpers';

describe('per-account sending limits', () => {
  async function setup(limits: { maxRecipientsPerMessage?: number; perHour?: number; perDay?: number }) {
    const env = await createTestEnv();
    env.config.sendLimits = { maxRecipientsPerMessage: 50, perHour: 50, perDay: 200, ...limits };
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');
    const send = async () =>
      run(env, clientOperation('sendMessage'), { request: encryptedMessage(alice, [bob], 'S', 'B') }, alice.row);
    return { env, alice, bob, send };
  }

  it('slows down bursts with RATE_LIMIT_EXCEEDED', async () => {
    const { send } = await setup({ perHour: 2 });
    expect((await send()).errors).toBeUndefined();
    expect((await send()).errors).toBeUndefined();
    const blocked = await send();
    expect(blocked.errors?.[0]).toMatchObject({ extensions: { code: 'RATE_LIMIT_EXCEEDED' } });
    expect(blocked.errors?.[0].message).toMatch(/at most 2 recipients per hour/);
  });

  it('caps the day with MESSAGE_LIMIT, which skemail-web shows as its limit modal', async () => {
    const { send } = await setup({ perDay: 1 });
    expect((await send()).errors).toBeUndefined();
    expect((await send()).errors?.[0]).toMatchObject({ extensions: { code: 'MESSAGE_LIMIT' } });
  });

  it('limits recipients per message and does not count rejected sends', async () => {
    const { env, alice, bob, send } = await setup({ maxRecipientsPerMessage: 1, perHour: 1 });
    const carol = await addUser(env, 'carol@skiff.local');
    const tooMany = await run(
      env,
      clientOperation('sendMessage'),
      { request: encryptedMessage(alice, [bob, carol], 'S', 'B') },
      alice.row
    );
    expect(tooMany.errors?.[0].message).toMatch(/at most 1 recipients/);
    // The rejected message did not use up the hourly allowance.
    expect((await send()).errors).toBeUndefined();
  });
});
