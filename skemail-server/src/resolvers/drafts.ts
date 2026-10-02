import { Context, requireUser } from '../context';
import { deleteDraft, listDrafts, upsertDraft } from '../db/misc';
import type { MutationCreateOrUpdateDraftArgs, MutationDeleteDraftArgs } from '../generated/graphql';

/** Drafts are opaque client-encrypted blobs. */
export const draftResolvers = {
  Query: {
    allDrafts: (_: unknown, __: unknown, ctx: Context) => listDrafts(ctx.db, requireUser(ctx).user_id)
  },
  Mutation: {
    createOrUpdateDraft: (_: unknown, { request }: MutationCreateOrUpdateDraftArgs, ctx: Context) => {
      upsertDraft(ctx.db, requireUser(ctx).user_id, request);
      return null;
    },
    deleteDraft: (_: unknown, { request }: MutationDeleteDraftArgs, ctx: Context) => {
      deleteDraft(ctx.db, requireUser(ctx).user_id, request.draftID);
      return null;
    }
  }
};
