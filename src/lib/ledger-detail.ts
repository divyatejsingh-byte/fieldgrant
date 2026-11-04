/**
 * One-line, human-readable summary of a ledger event's payload for the grid's Detail column.
 *  - Gate 1 events: failing covenants first (with their state), then the satisfied ones.
 *  - Overrides: the decision change and the officer's reason.
 *  - Payout failures: the message.
 * Returns "" for everything else or for an unparseable payload.
 */
export function ledgerDetail(eventType: string, payload: string | undefined): string {
  if (!payload) return "";
  try {
    const p = JSON.parse(payload);
    if (eventType.startsWith("STATUTORY_COMPLIANCE_")) {
      const bad = (p.covenants_failing ?? []).map((c: { name: string; state: string }) => `✗ ${c.name} (${String(c.state).toLowerCase()})`);
      const ok = (p.covenants_satisfied ?? []).map((c: { name: string }) => `✓ ${c.name}`);
      return [...bad, ...ok].join(" · ");
    }
    if (eventType === "OFFICER_OVERRIDE") return `${p.previous_decision} -> ${p.new_decision}: ${p.reason}`;
    if (eventType === "PAYOUT_FAILED") return String(p.message ?? "");
  } catch {
    /* unparseable payload: show nothing */
  }
  return "";
}
