# FieldGrant

A grant **tranche release agent** for philanthropic foundations and the grassroots NGOs they fund.
Built for the "Build What's Next with PayPal and AI" hackathon.

> **Honest framing.** FieldGrant is a **sandbox prototype** of tranche-release logic, in USD, for international
> grantmakers disbursing to registered partner NGOs. A real deployment would need per-jurisdiction compliance
> review (for example FCRA in India). It makes **no claim of legal compliance or production readiness**.
> PayPal is used in the **sandbox only**; the code refuses any non-sandbox PayPal host.

## Live demo

**https://fieldgrant.onrender.com** (PayPal sandbox only, mock documents, no login).

**Demo video (3:30):** https://youtu.be/IIK0vaQksng — a fresh live sandbox payment, the signature-verified webhook, the PayPal rail inspector, the AG Grid audit ledger, the review queue, compliance covenants, reports and the safety scenarios.

- Open the **Grantee** view, go to *Send documents*, and click one of the five one-click scenarios. Scenario 1 runs the full path: AI reads the documents twice, ten plain-code checks decide RELEASE, and a real PayPal **sandbox** payout is dispatched and settled.
- Open the payout ID (decision screen or ledger) to see the **PayPal Rail Inspector**: recipient, `sender_batch_id`, `PayPal-Request-Id`, status, and whether a **signature-verified webhook** arrived.
- The deployment is verified end to end: a live sandbox payout settled to `PAID`, and PayPal's `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` webhook was received and passed signature verification.
- It runs on Render's **free** instance, so the first request after 15 idle minutes takes about a minute, and the demo database resets on restart (it reseeds itself). `render.paid.yaml` is the variant with a persistent disk.

## The problem

A foundation awards a grant (e.g. $10,000) split into tranches (25% / 50% / 25%). Tranches 2 and 3 sit blocked for
months while program officers manually review receipts, attendance sheets and reports. Small NGOs suffer liquidity
crunches. FieldGrant shortens that loop without taking humans out of the risky cases.

## Who it is for

The landing page (`/`) links straight into two views with one click, and a header switcher flips between them without reloading or resetting data (an NGO's half-filled upload form is kept). The switch is presentation only, no authentication by design:

- **Grantmaker (the buyer).** Sets the compliance policy, sees the portfolio across partner NGOs, handles only the exceptions in the review queue (approve, hold or override with a mandatory reason), and has the full audit ledger. Evidence that passes every check is released automatically.
- **NGO partner (the beneficiary).** Submits receipts and rosters for a tranche, gets a decision quickly, a specific remediation note if something must be fixed, and is paid via PayPal on release instead of waiting months for manual review.

## How it works

1. An NGO field worker submits evidence for a tranche: vendor receipt (PDF/PNG/JPG), attendance roster, short memo.
2. A vision-capable LLM (Gemini or Claude) **extracts** structured fields, **twice**. It decides nothing.
3. Plain deterministic code normalizes amounts to integer cents, runs 10 compliance checks and **decides**:
   - **RELEASE**: all checks pass and extraction is reliable.
   - **OFFICER_REVIEW**: runs disagree, low confidence, a SOFT check failed, output invalid, or injected text found.
   - **HOLD**: a HARD check failed (overspend, duplicate receipt, date outside grant, spend cap).
4. Only after the decision, the model writes a plain-language explanation and remediation note. It receives
   structured check results only, never document text.
5. On RELEASE a **PayPal Payout** is sent. Webhooks (signature-verified), polling and a manual "Refresh status"
   button settle the final state. Officers can override any decision with a reason; it is logged.
6. Every event lands in an append-only ledger (AG Grid, CSV export).

## LLM guardrails (the non-executive boundary)

The model is an **OCR and structured-entity extractor** (step 1) and an **audited explainer** (step 4). It can never decide, approve, evaluate compliance, or trigger PayPal.

1. **Extract** (`src/lib/extraction/extract.ts`, `extractSubmissionEvidence`): multimodal input to a strict, typed JSON object (`responseMimeType: application/json`, validated by a `.strict()` zod schema). Amounts are returned as the text printed on the document and normalized to integer cents in code (BigInt, no floats, $1B sanity cap). Any invalid reply (extra keys, wrong types, banter, over-long text) marks the pass failed, the extraction **UNRELIABLE**, and the submission **OFFICER_REVIEW**. There is **no retry**.
2. **Check** and 3. **Decide** are pure TypeScript (`rules/checks.ts`, `rules/decide.ts`). Two independent extraction passes are compared in code; any disagreement on total, date, vendor, attendee count or line items routes to review.
4. **Explain** (`src/lib/explain.ts`, `generateAuditExplanation`): the model receives **only** a strictly validated facts object (decision, failed checks with their numbers, unmet covenants, fixed reason codes). It never sees the receipt, roster, memo, image or any free-text sentence. Its reply is parsed strictly and then **guarded**: a reply that claims an approval or payment the code did not decide, or contains instruction-like text, is discarded and a deterministic explanation is used instead.
5. **Execute**: PayPal payouts are created only by `payout/service.ts`, and only for a `RELEASE` decision made by code.

`tests/gemini-firewall.test.ts` attacks this boundary (a hostile `SYSTEM INSTRUCTION: ... AUTO_RELEASE` invoice, models that obey or parrot the injection, invalid replies, disagreeing passes, hostile strings aimed at the explainer) and asserts structurally that nothing in the LLM layer imports payout, PayPal, the database, the ledger, the pipeline or the rules.

**Limits, stated plainly:** the instruction-text scan is a net, not a proof: a determined attacker can rephrase, so the protection is that the model has no authority and its output is never trusted. The scan errs toward review (a rare false positive costs an officer a look). Vendor names that differ only in case or punctuation are treated as the same vendor in the consensus check. The Gemini client is a thin REST wrapper (verified against the live API), not the `@google/genai` SDK.

## Compliance covenants (Gate 1)

Before any document is read, every submission passes **Gate 1**: the compliance covenants written into the grant contract are checked against the grantee's **document vault**. It is deterministic code, so it costs no model calls and cannot be talked around.

- **Funder** (grantmaker view, `/ngo/[id]` then *Edit covenants*): pick recognised documents from the catalog (India: FCRA registration, SBI designated account, Sec 12AB; Kenya: NGO Board licence, KRA exemption; US: IRS 501(c)(3) letter, W-8BEN-E; funder-standard: OFAC screening, prior-FY audited accounts, safeguarding policy), apply a **location-aware preset** (e.g. "US Funder + India Grantee"), and add **custom covenants** with a category and a *payout blocking* toggle. Standard codes are re-resolved from the catalog on save, so names and categories cannot be spoofed.
- **Grantee** (`/partner`): a per-grant checklist shows each requirement as *Active*, *Expired* or *Missing*, with one-click **Link from vault** or **Upload new document** (reference number, expiry date and an optional PDF/PNG/JPG copy, hashed with SHA-256). A document in the vault satisfies every grant that requires it.
- **Pass condition:** a record must exist, be `ACTIVE`, and any expiry date must be on or after today. A malformed expiry fails closed.
- **Outcome:** a failing *blocking* covenant is a HARD failure: **HOLD before extraction** (no model call), with a remediation note naming what to add or renew. A failing *non-blocking* covenant is SOFT (officer review).
- **Audit:** `STATUTORY_COMPLIANCE_VERIFIED` or `STATUTORY_COMPLIANCE_FAILED` is written to the ledger with the satisfied and failing covenant lists, and the decision screen shows each covenant with its pass/fail.

**Limits, stated plainly:** vault records are **self-declared**. The prototype checks that a document is on file, active and unexpired. It does not verify authenticity against any registry (for example the FCRA or IRS databases), and it is not a statement of legal compliance. Grantee-typed text (document numbers) is never passed to the explanation model. Covenant edits apply to future submissions and are not themselves written to the ledger (the ledger is tranche-scoped).

## Funders and grantees (many-to-many)

A funder funds many NGOs and an NGO holds grants from many funders. The seed demonstrates both:

| Funder (default FY) | Grantee | Grant |
|---|---|---|
| Global Horizon Foundation (Jan–Dec) | CleanWater Initiative | Community Sanitation Units 2026, $10,000 (25/50/25) |
| Wellspring Health Trust (Apr–Mar) | HealthBridge Vaccine Drive | Village Immunization Drive 2026, $6,000 (25/50/25) |
| Wellspring Health Trust (Apr–Mar) | CleanWater Initiative | Clinic Handwashing and Sanitation 2026-27, $6,000 (30/40/30) |
| Beacon Global Giving (Jan–Dec) | Sunrise Women's Self-Help Group | Women's Tailoring Cooperative 2026, $4,000 (25/50/25) |

- **Grantmaker dashboard** (`/portfolio`): pick the active funder; every figure (committed / disbursed / verified, sector mix, tranche health, grantee cohort, review queue, ledger) is scoped to that funder and shown in its own fiscal year. A funder never sees another funder's grants to the same NGO.
- **Grantee dashboard** (`/partner`): inbound totals across all funders, plus one **facility card per funder**, each computed in that funder's FY model, with a one-click "Submit Tranche Evidence" that scopes the uploader to that tranche.
- **Pending milestone liquidity** = tranches still unlockable (awaiting evidence, in review, held, or dispatching); locked tranches are excluded.

## Fiscal-year capital utilization

The grantmaker dashboard shows three metrics for the ACTIVE FUNDER's fiscal year, all in integer cents:

| Metric | Definition |
|---|---|
| **Committed** | Each grant award pro-rated by days into the FY (cumulative rounding, so a grant spanning two FYs always sums to exactly its award) |
| **Disbursed** | Tranches `PAID` or `RELEASING` whose PayPal payout was dispatched inside the FY (`tranche.disbursed_at`) |
| **Verified utilized** | Receipt totals of approved submissions (auto-release or officer-approved), by **receipt date**; only the latest approved submission per tranche counts |

**Active float** = disbursed − verified utilized. It is shown signed: a negative value means receipts were approved but the payout has not been dispatched yet.

Each funder owns its FY model (Jan–Dec default, Apr–Mar, Jul–Jun, Oct–Sep), stored on the `foundation` row and switchable in the dashboard header; it drives all of that funder's portfolio accounting. FY labels use the start year (`FY2026` or `FY2026-27`). Each NGO has a `country_code` mapped to its statutory FY (IN, GB: Apr–Mar; US: Jan–Dec; KE, BD: Jul–Jun; others default to Jan–Dec). The decision screen shows both, and tags **Cross-FY Reconciled** when the same receipt date falls in differently numbered years for funder and grantee; such receipts are accounted in the funder's FY.

Seeded historical payments ("Seeded example") have dispatch dates but no receipts on file, so they appear as unverified float until proof is submitted.

## Reports (monthly optional, quarterly, annual)

Grantees share progress reports per grant (PDF, PNG or JPG) from **Reports**. Quarterly and annual reports are expected, monthly are optional. Each report is listed for the funder of that grant (and only that funder) on its **Reports** page and dashboard, and opens in a sandboxed viewer. Reports are shared documents only: they never reach the model, the rules or a payout decision, and the grantee note is length-limited display text.

## Auditability features

- **Extraction Consensus Diff** (decision screen): the two independent reads side by side (vendor, date, total, line-item sum, attendee count) with a "Confirmed (0% variance)" badge per matching field, and an amber explanation when reads differ or a document tried to instruct the AI.
- **PayPal Rail Inspector**: every `payout_batch_id` and `payout_item_id` (decision screen and ledger) opens a drawer with the sandbox destination email, batch status, `sender_batch_id`, the `PayPal-Request-Id` sent, dispatch time, the event trail and a "Trigger sandbox status poll" button. Webhook verification is shown as verified only when a webhook-written ledger row exists (the handler runs only after the signature check passes); otherwise it says none has arrived.
- **Gate 1 card**: the statutory and covenant documents a grant requires, with state, reference and expiry, visible to both views above the invoice rules.
- **One-click scenario bar** (Grantee > Send documents): five scenarios load the mock files, run the live pipeline and refresh the ledger and utilization figures. Each needs an open payment, so use Reset demo data to repeat.

## Render health and storage

`GET /api/health` is Render's health check and powers the header badge. It does a timed SQLite write (latency reported) and a write+delete in the uploads folder, and reports uptime, environment and whether the database and uploads sit on the mounted `/var/data` disk. It returns 503 when either write fails, so Render restarts a service whose disk is missing or read-only. The badge says "Render: Healthy (/var/data disk mounted)" only when that is true; locally it says "Local: Healthy (local disk)".

## How AG Grid is used

AG Grid Community is the working surface for every list a person has to act on, with one shared theme (`src/components/grid.tsx`):

- **Ledger** (`LedgerGrid`): toolbar with All / Auto-Released / Review Queue / Holds / PayPal Dispatched filters, real-time search and a currency-formatted CSV export; append-only audit trail with custom status and decision cell renderers, quick filter, per-column filters, band tabs, CSV export, a stable `getRowId`, live refresh with change-flash on status cells, click-through to the evidence behind a row, exception rows tinted, and a column layout (order, widths, sort, visibility) remembered per viewer with a reset button.
- **Review queue** (`/review`): single-row selection drives the decision panel, so an officer reads the AI-written explanation and approves or holds, with a mandatory reason that lands in the ledger.
- **Reports** (both sides): type tabs, quick filter, and an Open link per row.
- **All your payments** (`/partner/tranches`): every tranche across every funder with currency formatters, number filters and click-to-start on rows that need documents.

## AI model and PayPal APIs used, and how

**AI (Google Gemini REST API by default; Anthropic Claude also supported; model id from `GEMINI_MODEL` / `ANTHROPIC_MODEL`)**
- Extraction as schema-constrained JSON (Claude: forced tool use), always re-validated against a strict zod schema. Two independent runs are compared.
- A second, text-only call writes the explanation and remediation note after the code has decided.
- Everything sits behind `src/lib/llm/` so the provider is swappable. The model never approves, rejects or pays.
- **Prompt-injection defence in depth:** (1) the prompt treats documents as untrusted data and asks the model to
  flag, not obey, embedded instructions; (2) strict zod validation (unknown keys and long fields are rejected);
  (3) a code-side regex scan of every extracted string and the memo; (4) the explanation step never sees raw
  text. Any hit routes to OFFICER_REVIEW. Tested in `tests/pipeline.test.ts`.

**PayPal (REST, sandbox).** Verified against developer.paypal.com docs:
- OAuth2 client credentials: `POST /v1/oauth2/token`, token cached until expiry.
- Payouts: `POST /v1/payments/payouts` (USD, EMAIL recipient), `GET /v1/payments/payouts/{batch_id}` for status.
- Webhooks: `POST /v1/notifications/verify-webhook-signature` using the `PAYPAL-*` headers plus the raw event body.
  Unverifiable webhooks get HTTP 401 and are ignored. Events handled: `PAYMENT.PAYOUTS-ITEM.*`, `PAYMENT.PAYOUTSBATCH.*`.
- **Idempotency:** `sender_batch_id = FG-G{grant}-T{tranche}-A{attempt}` and a derived `PayPal-Request-Id`. The tranche
  is claimed (`RELEASING`) in one atomic DB transaction before the network call, so double clicks cannot pay twice.
  Ambiguous failures (network) retry with the same keys; definitive rejections open a new attempt.
- Handled errors: `INSUFFICIENT_FUNDS`, auth failures, validation errors, network errors: human-readable message
  plus a `PAYOUT_FAILED` ledger row, never a crash.

## Setup

Requirements: Node 20+ (tested on 24).

```bash
npm install
cp .env.example .env           # fill in locally; NEVER commit .env
npm run samples:generate       # synthetic receipts and rosters in /samples
npm run db:seed                # migrate + seed (also resets demo data)
npm run dev                    # http://localhost:3000
```

The app starts without keys: without an AI key every submission safely lands in OFFICER_REVIEW; without
PayPal credentials a RELEASE decision is saved and the payout step reports "PayPal sandbox credentials are not
configured" (retry once they are set).

### PayPal sandbox setup (by hand)

1. Log in at developer.paypal.com, set the dashboard to **Sandbox**.
2. Testing Tools → Sandbox Accounts: use a **Business** sender account with a sandbox balance, and create **three
   Personal** recipient accounts. Put their emails in `NGO1_PAYPAL_EMAIL`..`NGO3_PAYPAL_EMAIL`.
3. Apps & Credentials → Create App (Merchant) using the Business account; make sure **Payouts** is enabled.
   Copy Client ID / Secret into `.env`.
4. Add a webhook (HTTPS URL, e.g. an ngrok tunnel to `/api/webhooks/paypal`) for `PAYMENT.PAYOUTS-ITEM.*` and
   `PAYMENT.PAYOUTSBATCH.*`. Put its ID in `PAYPAL_WEBHOOK_ID`. Without a webhook, polling still settles payouts.
5. `npm run test:payout` sends one $1.00 sandbox payout to NGO 1. **Funded-sandbox note:** the sender balance must
   cover the tranche (the demo tranche is $5,000); top it up in the sandbox account page if needed.

### Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini key (secret) and a model id that accepts image and PDF input |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Optional alternative provider |
| `LLM_PROVIDER` | Optional: force `gemini` or `anthropic` (default: whichever key is set, Gemini first) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox REST app credentials (secret) |
| `PAYPAL_BASE_URL` | Must be a sandbox host (default `https://api-m.sandbox.paypal.com`) |
| `PAYPAL_WEBHOOK_ID` | ID of your sandbox webhook, for signature verification |
| `NGO1_PAYPAL_EMAIL`..`NGO3_PAYPAL_EMAIL` | Sandbox Personal recipient emails for the seeded NGOs |
| `DATABASE_PATH` | SQLite file (default `~/.fieldgrant/fieldgrant.sqlite`, outside the repo on purpose) |
| `UPLOADS_DIR` | Evidence storage, outside the web root (default `~/.fieldgrant/uploads`) |
| `MAX_UPLOAD_BYTES` | Upload limit (default 8 MB) |
| `NEXT_PUBLIC_GITHUB_URL` | Optional public repo URL; shows GitHub and Docs links on the landing page |
| `DEMO_RESET_ENABLED` | Set `false` to disable the footer "Reset demo data" button |

## Demo scenarios

Synthetic files in [samples/](samples) (see its README). Switch to **NGO partner** and submit them as the demo NGO
(CleanWater, tranche 2: $5,000 tranche, $2,500 training-kit budget line, 50 attendees, 10% tolerance):

| Sample | Expected |
|---|---|
| `scenario_clean` | RELEASE, payout starts, "Settling via PayPal..." |
| `scenario_overspend` | HOLD (~30% over) with a specific remediation note |
| `scenario_injection` | NOT RELEASE (receipt and memo contain injected instructions) |
| `scenario_duplicate` | Submit clean first, then this as HealthBridge: HOLD citing the cross-NGO duplicate |
| `scenario_lowquality` | OFFICER_REVIEW (blurry receipt) |

`npm run test:scenarios` runs all five against the real model on a throwaway DB (no PayPal calls) and reports
PASS/FAIL against these expectations. Reset between takes with the footer link or `npm run demo:reset`.

## Tests

```bash
npm test             # unit + pipeline + payout + webhook tests (mock LLM, mock PayPal test double)
npm run typecheck
```

Covered: every check, `decide`, amount normalization, idempotency keys, injection never RELEASE (mock LLM),
RELEASING/PAID tranches cannot pay twice (including concurrent calls), invalid webhook signatures rejected.
The PayPal test double lives in `tests/helpers.ts` and says nothing about real PayPal behaviour; real behaviour is
only confirmed by `npm run test:payout` and manual sandbox runs.

## Deploy to Render

`render.yaml` is the **free** blueprint (no persistent disk: data lives in `/tmp` and resets after restarts or 15 idle minutes; the demo reseeds itself). `render.paid.yaml` is the Starter + persistent-disk variant; copy it over `render.yaml` to use it.

`render.yaml` is a blueprint. SQLite needs a **persistent disk** (paid instance type). On the free tier, drop the
`disk` block: the DB lives on ephemeral storage and reseeds automatically on boot. Set secrets in the dashboard.
Register `https://<your-app>.onrender.com/api/webhooks/paypal` as the sandbox webhook URL.

## Known limitations

- No authentication or roles by design (single hardcoded grantmaker and field-worker personas).
- Currency is USD only. Not a statement of legal compliance in any jurisdiction.
- Payout status depends on PayPal sandbox behaviour; `UNCLAIMED` payouts (recipient without an account) stay
  "Settling" until claimed. Whether PayPal dedupes a repeated `PayPal-Request-Id` for an identical retry should be
  confirmed in sandbox testing.
- Extraction quality depends on the model; the design routes doubt to a human instead of trusting it.
- Background polling is in-process and bounded (about 10 minutes); the manual "Refresh status" button covers the rest.

## License

MIT. See [LICENSE](LICENSE).
