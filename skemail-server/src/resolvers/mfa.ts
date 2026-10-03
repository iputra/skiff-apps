import { GraphQLError } from 'graphql';
import { SignatureContext, verifyDetachedSignatureAsymmetric } from 'skiff-crypto';

import { Context } from '../context';
import type {
  MutationDisableMfaArgs,
  MutationEnrollMfaArgs,
  MutationRegenerateMfaBackupCodesArgs
} from '../generated/graphql';
import { disableTotp, enableTotp, isMfaEnabled, isValidTotpSecret, mfaFactors, regenerateBackupCodes } from '../mfa';
import { requireSrpForCurrentUser } from './auth';

/** The request is signed with the user's signing key (skiff-front-graphql crypto/v1/user.ts). */
function requireSignature(message: string, signature: string, signingPublicKey: string, context: SignatureContext) {
  let valid = false;
  try {
    valid = verifyDetachedSignatureAsymmetric(message, signature, signingPublicKey, context);
  } catch {
    // Malformed signature or key.
  }
  if (!valid) throw new GraphQLError('Invalid signature', { extensions: { code: 'FORBIDDEN' } });
}

/**
 * Turns on TOTP with the secret skemail-web generated (configureMFA) after the user confirmed a code from their
 * app. Needs the password; adding TOTP again while it is on is refused so the old secret cannot be swapped
 * without the current second factor (disable it first).
 */
function enrollMfa(_: unknown, { request }: MutationEnrollMfaArgs, ctx: Context) {
  const user = requireSrpForCurrentUser(ctx, request.loginSrpRequest);
  requireSignature(request.dataMFA, request.signature, user.signing_public_key, SignatureContext.EnrollMfa);
  if (!isValidTotpSecret(request.dataMFA)) throw new GraphQLError('Invalid TOTP secret');
  if (isMfaEnabled(ctx.db, user.user_id)) return { status: 'REJECTED', backupCodes: [] };
  // SAVED, not SUCCESS: that is what EnterMFA (skiff-front-utils) waits for before showing the backup codes.
  return { status: 'SAVED', backupCodes: enableTotp(ctx.db, user.user_id, request.dataMFA) };
}

/** Turns TOTP (and its backup codes) off. Needs the password and a current 2FA code. Hardware keys are not supported. */
function disableMfa(_: unknown, { request }: MutationDisableMfaArgs, ctx: Context) {
  const user = requireSrpForCurrentUser(ctx, request.loginSrpRequest);
  if (!request.disableTotp) return { status: 'REJECTED' };
  disableTotp(ctx.db, user.user_id);
  return { status: 'SUCCESS' };
}

/** Replaces the backup codes. Needs the password and a current 2FA code. */
function regenerateMfaBackupCodes(_: unknown, { request }: MutationRegenerateMfaBackupCodesArgs, ctx: Context) {
  const user = requireSrpForCurrentUser(ctx, request.loginSrpRequest);
  requireSignature(
    user.username,
    request.signature,
    user.signing_public_key,
    SignatureContext.RegenerateMfaBackupCodes
  );
  if (!isMfaEnabled(ctx.db, user.user_id)) return { status: 'REJECTED', backupCodes: [] };
  return { status: 'SUCCESS', backupCodes: regenerateBackupCodes(ctx.db, user.user_id) };
}

const NO_MFA = { totpData: null, backupCodes: [], webAuthnKeys: [] };

export const mfaResolvers = {
  User: {
    // Only the account owner learns whether (and how) their account uses 2FA.
    mfa: (parent: { userID: string }, _: unknown, ctx: Context) =>
      ctx.user?.user_id === parent.userID ? mfaFactors(ctx.db, parent.userID) : NO_MFA
  },
  Mutation: {
    enrollMfa,
    disableMfa,
    regenerateMfaBackupCodes
  }
};
