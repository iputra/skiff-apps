import { createApp } from './app';
import { loadConfig, loadDotEnv } from './config';
import { openDatabase } from './db/db';

async function main() {
  loadDotEnv();
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  const { app } = await createApp(db, config);
  app.listen(config.port, () => {
    console.log(`skemail-server ready at ${config.publicUrl}/graphql (db: ${config.databaseFile})`);
    console.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
