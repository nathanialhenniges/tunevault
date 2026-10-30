import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { version } from "../../package.json";

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
        call.agent.includes(`TuneVault/${version}`) &&
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

it("rechecks service policy before cached results and after a queued wait", async () => {
  vi.resetModules();
  const { fetchBounded } = await import("../../src/core/network");
  vi.useFakeTimers();
  const fetch = vi.fn(async () => Response.json({ recordings: [] }));
  vi.stubGlobal("fetch", fetch);
  let enabled = true;
  const policy = () => {
    if (!enabled) throw new Error("Metadata disabled");
  };
  const url = new URL("https://musicbrainz.org/ws/2/recording/?query=policy");
  const first = fetchBounded(url, 1000, false, undefined, policy);
  await vi.advanceTimersByTimeAsync(1);
  await first;
  enabled = false;
  await expect(
    fetchBounded(url, 1000, false, undefined, policy),
  ).rejects.toThrow("Metadata disabled");
  enabled = true;
  const queued = expect(
    fetchBounded(new URL(url.href + "-queued"), 1000, false, undefined, policy),
  ).rejects.toThrow("Metadata disabled");
  await vi.advanceTimersByTimeAsync(1);
  enabled = false;
  await vi.advanceTimersByTimeAsync(1200);
  await queued;
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("checks redirect policies and rejects cross-service or JSON archive requests", async () => {
  vi.resetModules();
  const { fetchBounded } = await import("../../src/core/network");
  vi.useFakeTimers();
  const fetch = vi.fn(
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://ia800000.us.archive.org/cover.jpg" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const policy = vi.fn((url: URL) => {
    if (url.hostname.endsWith(".archive.org"))
      throw new Error("Artwork disabled during redirect");
  });
  const redirected = expect(
    fetchBounded(
      new URL("https://coverartarchive.org/release/fixture/front-1200"),
      1000,
      true,
      undefined,
      policy,
    ),
  ).rejects.toThrow("Artwork disabled during redirect");
  await vi.advanceTimersByTimeAsync(1);
  await redirected;
  expect(policy).toHaveBeenCalledWith(
    new URL("https://ia800000.us.archive.org/cover.jpg"),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(
    fetchBounded(new URL("https://archive.org/private"), 1000),
  ).rejects.toThrow("Untrusted");
  await expect(
    fetchBounded(new URL("https://musicbrainz.org/image"), 1000, true),
  ).rejects.toThrow("Untrusted");
});

it("does not cache a response when its service is disabled while reading the body", async () => {
  vi.resetModules();
  const { fetchBounded } = await import("../../src/core/network");
  vi.useFakeTimers();
  let enabled = true;
  const policy = () => {
    if (!enabled) throw new Error("Metadata disabled while reading");
  };
  const fetch = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            enabled = false;
            controller.enqueue(new TextEncoder().encode('{"recordings":[]}'));
            controller.close();
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const url = new URL(
    "https://musicbrainz.org/ws/2/recording/?query=body-policy",
  );
  const disabled = expect(
    fetchBounded(url, 1000, false, undefined, policy),
  ).rejects.toThrow("Metadata disabled while reading");
  await vi.advanceTimersByTimeAsync(1);
  await disabled;
  enabled = true;
  fetch.mockImplementation(async () => Response.json({ recordings: [] }));
  const retry = fetchBounded(url, 1000, false, undefined, policy);
  await vi.advanceTimersByTimeAsync(1200);
  expect(JSON.parse((await retry).bytes.toString())).toEqual({
    recordings: [],
  });
  expect(fetch).toHaveBeenCalledTimes(2);
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
