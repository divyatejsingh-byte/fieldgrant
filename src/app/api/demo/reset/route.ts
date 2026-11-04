import { getDb, handle } from "@/lib/api";
import { env } from "@/lib/env";
import { PayoutError } from "@/lib/payout/service";
import { clearUploads } from "@/lib/uploads";
import { seedDatabase, seedEmailsFromEnv } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** Wipes and reseeds demo data (judges can re-run scenarios). Disable with DEMO_RESET_ENABLED=false. */
export const POST = () =>
  handle(async () => {
    if (process.env.DEMO_RESET_ENABLED === "false") throw new PayoutError("Demo reset is disabled.", 403);
    seedDatabase(getDb(), seedEmailsFromEnv());
    clearUploads(env.uploadsDir(), env.databasePath());
    return { ok: true };
  });
