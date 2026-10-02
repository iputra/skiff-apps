import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { graphqlUploadExpress } from 'graphql-upload-minimal';

import { Config } from './config';
import { Context, resolveUser, USER_ID_HEADER } from './context';
import { DB } from './db/db';
import { mtaStsPolicyText } from './mail/published';
import { attachmentDownloadHandler } from './resolvers/attachments';
import { buildSchema } from './schema';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function createApolloServer() {
  return new ApolloServer<Context>({
    schema: buildSchema(),
    // skemail-web sends queries through Apollo's BatchHttpLink.
    allowBatchedHttpRequests: true,
    // Multipart uploads come from apollo-upload-client, which does not send Apollo's preflight header.
    csrfPrevention: false
  });
}

export async function createApp(db: DB, config: Config) {
  const server = createApolloServer();
  await server.start();

  const app = express();
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/attachments/:id', attachmentDownloadHandler(db, config));
  // MTA-STS policy (RFC 8461); must be reachable as https://mta-sts.<domain>/.well-known/mta-sts.txt.
  app.get('/.well-known/mta-sts.txt', (_req, res) => res.type('text/plain').send(mtaStsPolicyText(config.mail)));
  app.use(
    '/graphql',
    graphqlUploadExpress({ maxFileSize: MAX_UPLOAD_BYTES, maxFiles: 20 }),
    express.json({ limit: '25mb' }),
    expressMiddleware(server, {
      context: async ({ req, res }): Promise<Context> => {
        const header = req.header(USER_ID_HEADER) || undefined;
        return { db, config, req, res, user: resolveUser(db, req.cookies ?? {}, header) };
      }
    })
  );
  return { app, server };
}
