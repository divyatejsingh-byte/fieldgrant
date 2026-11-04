import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanRawExtraction } from "../rules/fixtures";
import { ExtractionSchema } from "../extraction/schema";
import { GeminiProvider } from "./gemini";
import { configuredProvider } from "./index";

const reply = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] } : { error: { message: "bad" } }), { status });

describe("GeminiProvider (fetch mocked, fake key)", () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = "test-key-not-real"; process.env.GEMINI_MODEL = "test-model"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; });

  it("sends the key in a header (never the URL), inline files, and returns parseable JSON", async () => {
    const f = vi.fn().mockResolvedValue(reply(cleanRawExtraction()));
    vi.stubGlobal("fetch", f);
    const out = await new GeminiProvider().extract({ files: [{ name: "receipt", mediaType: "image/png", base64: "AAAA" }], memoText: "hi" });
    expect(ExtractionSchema.safeParse(out).success).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/models/test-model:generateContent");
    expect(String(url)).not.toContain("test-key-not-real");
    expect(init.headers["x-goog-api-key"]).toBe("test-key-not-real");
    expect(JSON.parse(init.body).contents[0].parts.some((p: any) => p.inlineData?.mimeType === "image/png")).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it("API errors and non-JSON replies throw (pipeline then routes to review)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({}, 500)));
    await expect(new GeminiProvider().extract({ files: [] })).rejects.toThrow(/500/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }))));
    await expect(new GeminiProvider().extract({ files: [] })).rejects.toThrow(/valid JSON/);
  });

  it("provider selection prefers Gemini when its key is set", () => {
    expect(configuredProvider()).toBe("gemini");
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(configuredProvider()).toBeNull();
  });
});
