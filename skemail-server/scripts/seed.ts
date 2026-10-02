/**
 * Creates demo accounts. skemail-web has no signup screen, so this is how accounts get created locally.
 *
 *   yarn seed:server                                   # alice@skiff.local and bob@skiff.local
 *   yarn seed:server carol@skiff.local:secret:Carol    # address:password[:display name], repeatable
 *
 * The default password is `password123`. Existing accounts are skipped.
 */
import { loadConfig, loadDotEnv } from '../src/config';
import { openDatabase } from '../src/db/db';
import { createUser, getUserByUsername } from '../src/db/users';
import { createAccountMaterial } from './clientCrypto';

const DEFAULT_ACCOUNTS = ['alice@skiff.local:password123:Alice', 'bob@skiff.local:password123:Bob'];

async function main() {
  loadDotEnv();
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  const specs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ACCOUNTS;

  for (const spec of specs) {
    const [username, password = 'password123', displayName] = spec.split(':');
    if (!username?.includes('@')) throw new Error(`Expected address:password[:name], got "${spec}"`);
    if (getUserByUsername(db, username)) {
      console.log(`exists   ${username}`);
      continue;
    }
    const material = await createAccountMaterial(password);
    const user = createUser(db, { username, displayName, ...material });
    console.log(`created  ${user.username} (password: ${password}, userID: ${user.user_id})`);
  }
  console.log(`database: ${config.databaseFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
