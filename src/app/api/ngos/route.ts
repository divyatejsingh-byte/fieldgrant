import { getDb, handle } from "@/lib/api";
import { listNgos } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const GET = () => handle(() => listNgos(getDb()));
