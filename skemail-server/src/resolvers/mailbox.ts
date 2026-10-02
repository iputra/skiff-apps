import { randomUUID } from 'crypto';

import { Context, requireUser } from '../context';
import {
  Address,
  countUnread,
  createUserLabel,
  deleteThreads,
  deleteUserLabel,
  editUserLabel,
  getThread,
  listThreadIDs,
  listUserLabels,
  markClientsideFiltered,
  modifySystemLabels,
  modifyUserLabels,
  setRead,
  setReadForLabel,
  toGraphQLLabel
} from '../db/mail';
import { getAliases } from '../db/users';
import type {
  MutationApplyLabelsArgs,
  MutationBulkApplyLabelsArgs,
  MutationBulkTrashArgs,
  MutationCreateUserLabelArgs,
  MutationDeleteThreadArgs,
  MutationDeleteUserLabelArgs,
  MutationEditUserLabelArgs,
  MutationMarkThreadsAsClientsideFilteredArgs,
  MutationSetAllThreadsReadStatusArgs,
  MutationSetReadStatusArgs,
  QueryFilteredThreadIDsArgs,
  QueryMailboxArgs,
  QueryNumMailboxThreadsArgs,
  QueryUnreadAllLabelsArgs,
  QueryUnreadArgs,
  QueryUserThreadArgs,
  QueryUserThreadsArgs
} from '../generated/graphql';

const DEFAULT_PAGE_SIZE = 20;

const viewerAliases = (ctx: Context, userID: string) => getAliases(ctx.db, userID).map((a) => a.alias);

function threadsByID(ctx: Context, userID: string, threadIDs: string[], includeDeleted = false) {
  const aliases = viewerAliases(ctx, userID);
  return threadIDs.flatMap((id) => {
    const t = getThread(ctx.db, userID, id, aliases, includeDeleted);
    return t ? [t] : [];
  });
}

function mailbox(_: unknown, { request }: QueryMailboxArgs, ctx: Context) {
  const user = requireUser(ctx);
  const limit = request.limit ?? DEFAULT_PAGE_SIZE;
  const sortBySent = request.label === 'SENT';
  // Ask for one extra thread to learn whether there is another page.
  const ids = listThreadIDs(ctx.db, user.user_id, {
    label: request.label,
    userLabels: request.userLabels,
    read: request.filters?.read,
    before: request.cursor ? { date: request.cursor.date, threadID: request.cursor.threadID } : null,
    updatedAfter: request.emailsUpdatedAfterDate,
    clientsideFiltersApplied: request.clientsideFiltersApplied,
    limit: limit + 1,
    sortBySent
  });
  const threads = threadsByID(ctx, user.user_id, ids.slice(0, limit));
  const last = threads[threads.length - 1];
  return {
    threads,
    pageInfo: {
      hasNextPage: ids.length > limit,
      cursor: last
        ? {
            threadID: last.threadID,
            date: sortBySent ? last.sentLabelUpdatedAt ?? last.emailsUpdatedAt : last.emailsUpdatedAt
          }
        : null
    }
  };
}

const updatedThreadLabels = (ctx: Context, userID: string, threadIDs: string[]) =>
  threadsByID(ctx, userID, threadIDs).map((t) => ({
    threadID: t.threadID,
    systemLabels: t.attributes.systemLabels,
    userLabels: t.attributes.userLabels
  }));

function changeLabels(mode: 'add' | 'remove') {
  return (_: unknown, { request }: MutationApplyLabelsArgs, ctx: Context) => {
    const user = requireUser(ctx);
    if (!request) return { updatedThreads: [] };
    const system = request.systemLabels ?? [];
    const userLabels = request.userLabels ?? [];
    modifySystemLabels(
      ctx.db,
      user.user_id,
      request.threadIDs,
      mode === 'add' ? system : [],
      mode === 'remove' ? system : []
    );
    modifyUserLabels(
      ctx.db,
      user.user_id,
      request.threadIDs,
      mode === 'add' ? userLabels : [],
      mode === 'remove' ? userLabels : []
    );
    return { updatedThreads: updatedThreadLabels(ctx, user.user_id, request.threadIDs) };
  };
}

/** Bulk actions run synchronously; the job ID only exists so the client's status polling succeeds. */
function bulkChangeLabels(mode: 'add' | 'remove') {
  return (_: unknown, { request }: MutationBulkApplyLabelsArgs, ctx: Context) => {
    const user = requireUser(ctx);
    if (request) {
      const threadIDs = listThreadIDs(ctx.db, user.user_id, { label: request.targetLabel });
      changeLabels(mode)(
        _,
        { request: { threadIDs, systemLabels: request.systemLabels, userLabels: request.userLabels } },
        ctx
      );
    }
    return { jobID: randomUUID() };
  };
}

export const mailboxResolvers = {
  Query: {
    mailbox,
    userThread: (_: unknown, { threadID }: QueryUserThreadArgs, ctx: Context) => {
      const user = requireUser(ctx);
      return threadID ? getThread(ctx.db, user.user_id, threadID, viewerAliases(ctx, user.user_id)) : null;
    },
    userThreads: (_: unknown, { threadIDs, returnDeleted }: QueryUserThreadsArgs, ctx: Context) =>
      threadsByID(ctx, requireUser(ctx).user_id, threadIDs, !!returnDeleted),
    unread: (_: unknown, { label }: QueryUnreadArgs, ctx: Context) =>
      countUnread(ctx.db, requireUser(ctx).user_id, label),
    unreadAllLabels: (_: unknown, { labels }: QueryUnreadAllLabelsArgs, ctx: Context) => {
      const user = requireUser(ctx);
      return labels.map((label) => ({ label, count: countUnread(ctx.db, user.user_id, label) }));
    },
    numMailboxThreads: (_: unknown, { label }: QueryNumMailboxThreadsArgs, ctx: Context) =>
      listThreadIDs(ctx.db, requireUser(ctx).user_id, { label }).length,
    /** Keeps only the given threads that carry every requested label. */
    filteredThreadIDs: (_: unknown, { request }: QueryFilteredThreadIDsArgs, ctx: Context) => {
      const user = requireUser(ctx);
      const labels = [...(request.systemLabels ?? []), ...(request.userLabelIDs ?? [])];
      const allowed = labels.length
        ? labels
            .map((label) => new Set(listThreadIDs(ctx.db, user.user_id, { label })))
            .reduce((acc, set) => new Set([...acc].filter((id) => set.has(id))))
        : new Set(listThreadIDs(ctx.db, user.user_id, {}));
      const threadIDs = request.threadIDs.filter((id) => allowed.has(id));
      return { threadIDs, numThreadIDsRemoved: request.threadIDs.length - threadIDs.length };
    },
    userLabels: (_: unknown, __: unknown, ctx: Context) =>
      listUserLabels(ctx.db, requireUser(ctx).user_id).map(toGraphQLLabel),
    bulkActionJobStatus: () => ({ completed: true, jobStatus: 'COMPLETED' })
  },
  Mutation: {
    setReadStatus: (_: unknown, { request }: MutationSetReadStatusArgs, ctx: Context) => ({
      updatedThreadIDs: request ? setRead(ctx.db, requireUser(ctx).user_id, request.threadIDs, request.read) : []
    }),
    setAllThreadsReadStatus: (_: unknown, { request }: MutationSetAllThreadsReadStatusArgs, ctx: Context) => {
      setReadForLabel(ctx.db, requireUser(ctx).user_id, request.label, request.read);
      return true;
    },
    markThreadAsOpened: () => null,
    markThreadsAsClientsideFiltered: (
      _: unknown,
      { input }: MutationMarkThreadsAsClientsideFilteredArgs,
      ctx: Context
    ) => {
      markClientsideFiltered(ctx.db, requireUser(ctx).user_id, input.threadIDs);
      return null;
    },
    applyLabels: changeLabels('add'),
    removeLabels: changeLabels('remove'),
    bulkApplyLabels: bulkChangeLabels('add'),
    bulkRemoveLabels: bulkChangeLabels('remove'),
    bulkTrash: (_: unknown, { request }: MutationBulkTrashArgs, ctx: Context) => {
      const user = requireUser(ctx);
      const aliases = viewerAliases(ctx, user.user_id);
      const sender = request.sender.toLowerCase();
      const ids = listThreadIDs(ctx.db, user.user_id, {}).filter((id) =>
        getThread(ctx.db, user.user_id, id, aliases)?.emails.some(
          (e) => (e.from as Address).address.toLowerCase() === sender
        )
      );
      modifySystemLabels(ctx.db, user.user_id, ids, ['TRASH'], []);
      return { jobID: randomUUID() };
    },
    deleteThread: (_: unknown, { request }: MutationDeleteThreadArgs, ctx: Context) => {
      if (request) deleteThreads(ctx.db, requireUser(ctx).user_id, request.threadIDs);
      return null;
    },
    bulkDeleteTrashedThreads: (_: unknown, __: unknown, ctx: Context) => {
      const user = requireUser(ctx);
      deleteThreads(ctx.db, user.user_id, listThreadIDs(ctx.db, user.user_id, { label: 'TRASH' }));
      return { jobID: randomUUID() };
    },
    createUserLabel: (_: unknown, { request }: MutationCreateUserLabelArgs, ctx: Context) =>
      request ? createUserLabel(ctx.db, requireUser(ctx).user_id, request) : null,
    editUserLabel: (_: unknown, { request }: MutationEditUserLabelArgs, ctx: Context) =>
      request ? editUserLabel(ctx.db, requireUser(ctx).user_id, request) : null,
    deleteUserLabel: (_: unknown, { request }: MutationDeleteUserLabelArgs, ctx: Context) => {
      if (request) deleteUserLabel(ctx.db, requireUser(ctx).user_id, request.labelID);
      return null;
    }
  }
};
