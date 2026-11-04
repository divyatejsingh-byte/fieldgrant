import { getDb, handle } from "@/lib/api";
import { listFoundations } from "@/lib/foundations";

export const dynamic = "force-dynamic";
export const GET = () => handle(() => listFoundations(getDb()));
