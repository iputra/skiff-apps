import { Context, requireUser } from '../context';
import { deleteContacts, listContacts, upsertContact } from '../db/misc';
import type {
  MutationCreateOrUpdateContactArgs,
  MutationDeleteContactArgs,
  MutationDeleteContactsArgs,
  QueryContactsArgs
} from '../generated/graphql';

export const contactResolvers = {
  Query: {
    allContacts: (_: unknown, __: unknown, ctx: Context) => listContacts(ctx.db, requireUser(ctx).user_id),
    contacts: (_: unknown, { request }: QueryContactsArgs, ctx: Context) =>
      listContacts(ctx.db, requireUser(ctx).user_id, request.emailAddresses)
  },
  Mutation: {
    createOrUpdateContact: (_: unknown, { request }: MutationCreateOrUpdateContactArgs, ctx: Context) => {
      upsertContact(ctx.db, requireUser(ctx).user_id, request);
      return null;
    },
    deleteContact: (_: unknown, { request }: MutationDeleteContactArgs, ctx: Context) => {
      deleteContacts(ctx.db, requireUser(ctx).user_id, {
        contactIDs: request.contactID ? [request.contactID] : [],
        emailAddress: request.emailAddress
      });
      return null;
    },
    deleteContacts: (_: unknown, { request }: MutationDeleteContactsArgs, ctx: Context) => {
      deleteContacts(ctx.db, requireUser(ctx).user_id, { contactIDs: request.contactIDs });
      return null;
    }
  }
};
