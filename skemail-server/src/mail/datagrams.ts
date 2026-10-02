/**
 * The encrypted email formats skemail-web uses (libs/skiff-front-graphql/src/crypto/v2/email.ts). The server needs
 * them only at the boundary with other mail servers: to read an outgoing message it must hand to SMTP, and to
 * encrypt an incoming message for its recipient.
 */
import { Range } from 'semver';
import { createProtoWrapperDatagramV2, decryptDatagramV2, encryptDatagramV2 } from 'skiff-crypto';
import {
  AttachmentBody,
  AttachmentHeader,
  AttachmentMetadataBody,
  AttachmentMetadataHeader,
  MailHTMLBody,
  MailHTMLHeader,
  MailSubjectBody,
  MailSubjectHeader,
  MailTextAsHTMLBody,
  MailTextAsHTMLHeader,
  MailTextBody,
  MailTextHeader
} from 'skiff-mail-protos';

const datagram = <H, B>(type: string, header: H, body: B) =>
  createProtoWrapperDatagramV2(type, header as never, body as never, '0.1.0', new Range('0.1.*'));

export const MailSubjectDatagram = datagram('skemail.mailSubject', MailSubjectHeader, MailSubjectBody);
export const MailTextDatagram = datagram('skemail.mailText', MailTextHeader, MailTextBody);
export const MailHtmlDatagram = datagram('skemail.mailHtml', MailHTMLHeader, MailHTMLBody);
export const MailTextAsHTMLDatagram = datagram('skemail.MailTextAsHTML', MailTextAsHTMLHeader, MailTextAsHTMLBody);
export const AttachmentDatagram = datagram('skemail.attachment', AttachmentHeader, AttachmentBody);
export const AttachmentMetadataDatagram = datagram(
  'skemail.attachmentMetadata',
  AttachmentMetadataHeader,
  AttachmentMetadataBody
);

export interface AttachmentMetadata {
  contentType: string;
  contentDisposition: string;
  filename: string;
  checksum: string;
  size: number;
  contentId: string;
}

type AnyDatagram = typeof MailSubjectDatagram;

export const encrypt = (dg: AnyDatagram, body: Record<string, unknown>, sessionKey: string): string =>
  encryptDatagramV2(dg, {}, body as never, sessionKey).encryptedData;

export const decrypt = <T>(dg: AnyDatagram, sessionKey: string, encryptedData: string): T =>
  decryptDatagramV2(dg, sessionKey, encryptedData).body as T;
