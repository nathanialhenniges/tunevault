import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shares MusicBrainz/CAA pacing, preserves the User-Agent and caches validated responses", async () => {
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#123456" },
  })
    .jpeg()
    .toBuffer();
  vi.resetModules();
  const { fetchBounded } = await import("../../src/core/network");
  const calls: { at: number; url: string; agent: string }[] = [];
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async (url: URL, input: RequestInit) => {
    calls.push({
      at: Date.now(),
      url: url.href,
      agent: String((input.headers as Record<string, string>)["User-Agent"]),
    });
    return url.hostname === "musicbrainz.org"
      ? Response.json({ recordings: [] })
      : new Response(image, { headers: { "content-type": "image/jpeg" } });
  });
  const metadata = new URL(
    "https://musicbrainz.org/ws/2/recording/?query=synthetic",
  );
  const cover = new URL(
    "https://coverartarchive.org/release/fixture/front-500",
  );
  const requests = Promise.all([
    fetchBounded(metadata, 1000),
    fetchBounded(cover, 1000, true),
  ]);
  await vi.advanceTimersByTimeAsync(1200);
  const results = await requests;
  expect(calls).toHaveLength(2);
  expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(1100);
  expect(
    calls.every(
      (call) =>
        call.agent.includes("TuneVault/4.0.0") &&
        call.agent.includes("github.com/nathanialhenniges/tunevault"),
    ),
  ).toBe(true);
  results[1].bytes.fill(0);
  expect((await fetchBounded(cover, 1000, true)).bytes).toEqual(image);
  expect(
    JSON.parse((await fetchBounded(metadata, 1000)).bytes.toString()),
  ).toEqual({ recordings: [] });
  expect(calls).toHaveLength(2);
});

it("backs off on 503/429, respects Retry-After and allows cancellation during shared backoff", async () => {
  vi.resetModules();
  const { fetchBounded } = await import("../../src/core/network");
  vi.useFakeTimers();
  const times: number[] = [];
  vi.stubGlobal("fetch", async () => {
    times.push(Date.now());
    return times.length === 1
      ? new Response("busy", { status: 503, headers: { "retry-after": "3" } })
      : Response.json({ recordings: [] });
  });
  const recovering = fetchBounded(
    new URL("https://musicbrainz.org/ws/2/recording/?query=retry"),
    1000,
  );
  await vi.advanceTimersByTimeAsync(3100);
  expect(JSON.parse((await recovering).bytes.toString())).toEqual({
    recordings: [],
  });
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(3000);
  const abort = new AbortController();
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("busy", { status: 429, headers: { "retry-after": "30" } }),
  );
  const cancelled = expect(
    fetchBounded(
      new URL("https://coverartarchive.org/release/cancel/front-500"),
      1000,
      true,
      abort.signal,
    ),
  ).rejects.toThrow("Cancelled fixture");
  await vi.advanceTimersByTimeAsync(1200);
  abort.abort(new Error("Cancelled fixture"));
  await cancelled;
});

it("rejects untrusted redirects, oversized bodies and invalid images without caching failures", async () => {
  vi.resetModules();
  const { fetchBounded } = await import("../../src/core/network");
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://untrusted.invalid/image" },
      }),
  );
  const untrusted = expect(
    fetchBounded(
      new URL("https://coverartarchive.org/release/bad/front-500"),
      1000,
      true,
    ),
  ).rejects.toThrow("Untrusted");
  await vi.advanceTimersByTimeAsync(1);
  await untrusted;
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("invalid image", {
        headers: { "content-type": "image/jpeg" },
      }),
  );
  const broken = expect(
    fetchBounded(
      new URL("https://coverartarchive.org/release/broken/front-500"),
      1000,
      true,
    ),
  ).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(1200);
  await broken;
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#112233" },
  })
    .jpeg()
    .toBuffer();
  const fetch = vi.fn(
    async () =>
      new Response(image, { headers: { "content-type": "image/jpeg" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const repaired = fetchBounded(
    new URL("https://coverartarchive.org/release/broken/front-500"),
    1000,
    true,
  );
  await vi.advanceTimersByTimeAsync(1200);
  expect((await repaired).bytes).toEqual(image);
  const oversized = expect(
    fetchBounded(
      new URL("https://musicbrainz.org/ws/2/recording/?query=large"),
      2,
    ),
  ).rejects.toThrow("too large");
  await vi.advanceTimersByTimeAsync(1200);
  await oversized;
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort(new Error("Already cancelled"));
  await expect(
    fetchBounded(
      new URL("https://musicbrainz.org/ws/2/recording/?query=no"),
      1000,
      false,
      alreadyCancelled.signal,
    ),
  ).rejects.toThrow("Already cancelled");
});
