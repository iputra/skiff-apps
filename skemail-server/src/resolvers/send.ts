import { randomUUID } from 'crypto';

import { GraphQLError } from 'graphql';

import { Context, requireUser } from '../context';
import { now } from '../db/db';
import { deliverEmail, findThreadIDForEmail, getEmailRow, NewEmail } from '../db/mail';
import { getAliases, getUserByAlias, normalizeAddress, PublicKey } from '../db/users';
import type {
  MutationReplyToMessageArgs,
  MutationSendMessageArgs,
  SendAddressRequest,
  SendEmailRequest
} from '../generated/graphql';
import { enqueueOutbound } from '../mail/outbound';
import { storeUpload } from './attachments';

interface Copy {
  labels: Set<string>;
  read: boolean;
  encryptedSessionKey: string;
  encryptedBy: PublicKey;
}

const toAddress = (a: SendAddressRequest) => ({ address: normalizeAddress(a.address), name: a.name ?? null });

/**
 * Stores one copy of the email per participant: the sender gets it under SENT, every recipient that has
 * an account here gets it under INBOX. Each copy carries the session key the client encrypted for that
 * participant, so the server never sees plaintext. Recipients without an account are queued for SMTP
 * delivery, using the session key the client wrapped for the server (externalEncryptedSessionKey).
 */
async function deliver(
  ctx: Context,
  message: SendEmailRequest,
  existingThreadID: string | null,
  inReplyTo: string | null = null
) {
  const sender = requireUser(ctx);
  const fromAddress = normalizeAddress(message.from.address);
  if (!getAliases(ctx.db, sender.user_id).some((a) => a.alias === fromAddress)) {
    throw new GraphQLError(`You cannot send from ${message.from.address}`, { extensions: { code: 'FORBIDDEN' } });
  }
  if (!message.from.encryptedSessionKey) {
    throw new GraphQLError('from.encryptedSessionKey is required so the sender can read the sent copy');
  }

  const copies = new Map<string, Copy>();
  copies.set(sender.user_id, {
    labels: new Set(['SENT']),
    read: true,
    encryptedSessionKey: message.from.encryptedSessionKey.encryptedSessionKey,
    encryptedBy: message.from.encryptedSessionKey.encryptedBy
  });

  const external: string[] = [];
  for (const rcpt of [...message.to, ...message.cc, ...message.bcc]) {
    const user = getUserByAlias(ctx.db, rcpt.address);
    if (!user) {
      external.push(rcpt.address);
      continue;
    }
    const existing = copies.get(user.user_id);
    if (existing) {
      existing.labels.add('INBOX');
      continue;
    }
    if (!rcpt.encryptedSessionKey) {
      console.warn(`[send] no session key for local recipient ${rcpt.address}; skipping delivery`);
      continue;
    }
    copies.set(user.user_id, {
      labels: new Set(['INBOX']),
      read: false,
      encryptedSessionKey: rcpt.encryptedSessionKey.encryptedSessionKey,
      encryptedBy: rcpt.encryptedSessionKey.encryptedBy
    });
  }
  if (external.length && !message.externalEncryptedSessionKey) {
    throw new GraphQLError('externalEncryptedSessionKey is required to send to addresses outside this server');
  }

  const attachments = await Promise.all(
    message.attachments.map(async (a) => ({
      attachmentID: randomUUID(),
      encryptedMetadata: a.encryptedMetadata.encryptedData,
      blobPath: await storeUpload(ctx.config, a.encryptedContent.encryptedFile)
    }))
  );

  const emailID = randomUUID();
  const threadID = existingThreadID ?? randomUUID();
  const createdAt = now();
  const messageId = `<${emailID}@${fromAddress.split('@')[1]}>`;
  for (const [userID, copy] of copies) {
    const email: NewEmail = {
      emailID,
      threadID,
      userID,
      from: toAddress(message.from),
      to: message.to.map(toAddress),
      cc: message.cc.map(toAddress),
      bcc: message.bcc.map(toAddress),
      encryptedSubject: message.encryptedSubject.encryptedData,
      encryptedText: message.encryptedText.encryptedData,
      encryptedHtml: message.encryptedHtml.encryptedData,
      encryptedTextAsHtml: message.encryptedTextAsHtml.encryptedData,
      encryptedTextSnippet: message.encryptedTextSnippet?.encryptedData,
      encryptedSessionKey: copy.encryptedSessionKey,
      encryptedBy: copy.encryptedBy,
      scheduleSendAt: message.scheduleSendAt ?? null,
      createdAt,
      messageId
    };
    deliverEmail(ctx.db, email, { addLabels: [...copy.labels], read: copy.read }, attachments);
  }
  if (external.length && message.externalEncryptedSessionKey) {
    enqueueOutbound(ctx.db, {
      senderUserID: sender.user_id,
      emailID,
      externalSessionKey: message.externalEncryptedSessionKey,
      recipients: external,
      inReplyTo
    });
  }
  return { messageID: emailID, threadID };
}

export const sendResolvers = {
  Mutation: {
    sendMessage: (_: unknown, { message }: MutationSendMessageArgs, ctx: Context) => {
      if (!message) throw new GraphQLError('message is required');
      return deliver(ctx, message, null);
    },
    replyToMessage: (_: unknown, { message }: MutationReplyToMessageArgs, ctx: Context) => {
      if (!message) throw new GraphQLError('message is required');
      const user = requireUser(ctx);
      const threadID = findThreadIDForEmail(ctx.db, user.user_id, message.replyID);
      if (!threadID) throw new GraphQLError(`Unknown email ${message.replyID}`, { extensions: { code: 'NOT_FOUND' } });
      const inReplyTo = getEmailRow(ctx.db, user.user_id, message.replyID)?.message_id ?? null;
      return deliver(ctx, message, threadID, inReplyTo);
    }
  }
};
