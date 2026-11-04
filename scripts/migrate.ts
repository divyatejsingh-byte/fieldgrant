import { loadEnv } from "../src/lib/env";
loadEnv();
import { openDb, migrate } from "../src/lib/db";

const db = openDb();
const applied = migrate(db);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database already up to date.");
