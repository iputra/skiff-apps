import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

import type { Request, Response } from 'express';
import type { FileUpload } from 'graphql-upload-minimal';

import { Config } from '../config';
import { Context, requireUser } from '../context';
import { DB, fromJSON } from '../db/db';
import { getAttachment } from '../db/mail';
import type { QueryAttachmentsArgs } from '../generated/graphql';

const LINK_TTL_MS = 60 * 60 * 1000;

/**
 * Download links are signed instead of cookie-authenticated: the client fetches them with a plain
 * `axios.get`, which does not send cookies cross-origin.
 */
const signature = (config: Config, userID: string, attachmentID: string, expires: number) =>
  createHmac('sha256', config.linkSecret).update(`${userID}:${attachmentID}:${expires}`).digest('base64url');

export function signedDownloadLink(config: Config, userID: string, attachmentID: string) {
  const expires = Date.now() + LINK_TTL_MS;
  const sig = signature(config, userID, attachmentID, expires);
  const query = new URLSearchParams({ u: userID, e: String(expires), s: sig });
  return `${config.publicUrl}/attachments/${encodeURIComponent(attachmentID)}?${query}`;
}

/** Streams an uploaded (already client-encrypted) attachment to disk and returns its path. */
export async function storeUpload(config: Config, upload: Promise<FileUpload>): Promise<string> {
  const file = await upload;
  fs.mkdirSync(config.attachmentsDir, { recursive: true });
  const blobPath = path.join(config.attachmentsDir, randomUUID());
  await pipeline(file.createReadStream(), fs.createWriteStream(blobPath));
  return blobPath;
}

export function attachmentDownloadHandler(db: DB, config: Config) {
  return (req: Request, res: Response) => {
    const { u: userID, e, s } = req.query as Record<string, string | undefined>;
    const attachmentID = req.params.id;
    const expires = Number(e);
    if (!userID || !s || !expires || expires < Date.now()) return res.status(403).send('Link expired or invalid');
    const expected = Buffer.from(signature(config, userID, attachmentID, expires));
    const given = Buffer.from(s);
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      return res.status(403).send('Invalid link');
    const attachment = getAttachment(db, userID, attachmentID);
    if (!attachment || !fs.existsSync(attachment.blob_path)) return res.status(404).send('Not found');
    res.type('text/plain');
    fs.createReadStream(attachment.blob_path).pipe(res);
  };
}

export const attachmentResolvers = {
  Query: {
    attachments: (_: unknown, { ids }: QueryAttachmentsArgs, ctx: Context) => {
      const user = requireUser(ctx);
      return (ids ?? []).map((id) => {
        const attachment = id ? getAttachment(ctx.db, user.user_id, id) : undefined;
        if (!attachment) return null;
        return {
          attachmentID: attachment.attachment_id,
          downloadLink: signedDownloadLink(ctx.config, user.user_id, attachment.attachment_id),
          // Attachments are encrypted with their email's session key.
          encryptedSessionKey: {
            encryptedSessionKey: attachment.encrypted_session_key,
            encryptedBy: fromJSON(attachment.encrypted_by_json, { key: '' })
          }
        };
      });
    }
  }
};
