// Seeds 3 NGOs / 3 grants. Re-running WIPES all app data and reseeds ("reset demo data").
import { loadEnv } from "../src/lib/env";
loadEnv();
import { openDb, migrate } from "../src/lib/db";
import { seedDatabase, seedEmailsFromEnv } from "../src/lib/seed";

const db = openDb();
migrate(db);
console.log(seedDatabase(db, seedEmailsFromEnv()).tranches.join("\n"));
if ([1, 2, 3].some((n) => !process.env[`NGO${n}_PAYPAL_EMAIL`])) {
  console.warn("\nNote: one or more NGOn_PAYPAL_EMAIL vars are unset; placeholder emails were stored. Set them in .env and re-run the seed.");
}
