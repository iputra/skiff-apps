import { createApp } from './app';
import { loadConfig, loadDotEnv } from './config';
import { openDatabase } from './db/db';
import { loadDkimKey } from './mail/dkim';
import { createInboundServer } from './mail/inbound';
import { startOutboundWorker } from './mail/outbound';

async function main() {
  loadDotEnv();
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  const { app } = await createApp(db, config);
  app.listen(config.port, () => {
    console.log(`skemail-server ready at ${config.publicUrl}/graphql (db: ${config.databaseFile})`);
    console.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
  });

  const { mail } = config;
  loadDkimKey(mail);
  if (mail.smtpPort > 0) {
    createInboundServer(db, config).listen(mail.smtpPort, mail.smtpHost, () => {
      console.log(`SMTP (MX) for ${mail.domains.join(', ')} listening on ${mail.smtpHost}:${mail.smtpPort}`);
    });
  }
  startOutboundWorker(db, config);
  console.log(
    `Outbound delivery ${
      mail.outboundEnabled ? 'enabled' : 'paused (OUTBOUND_ENABLED=false)'
    }; DNS records: yarn workspace skemail-server dns`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
