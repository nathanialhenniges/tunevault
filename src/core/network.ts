import sharp from "sharp";

const userAgent =
  "TuneVault/4.0.0 (https://github.com/nathanialhenniges/tunevault)";
let queue = Promise.resolve();
let nextRequestAt = 0;
const cache = new Map<
  string,
  { bytes: Buffer; mime: string; expires: number }
>();
let cacheBytes = 0;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new Error("Metadata request cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function trusted(url: URL, allowImageRedirects: boolean) {
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (!["musicbrainz.org", "coverartarchive.org", "archive.org"].includes(
      url.hostname,
    ) &&
      !(allowImageRedirects && url.hostname.endsWith(".archive.org")))
  )
    throw new Error("Untrusted metadata/artwork URL");
}

export async function fetchBounded(
  url: URL,
  limit: number,
  allowImageRedirects = false,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; mime: string }> {
  trusted(url, allowImageRedirects);
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20 * 1024 * 1024)
    throw new Error("Invalid provider response bound");
  const key = `${url.href}|${limit}|${allowImageRedirects}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return { bytes: Buffer.from(cached.bytes), mime: cached.mime };
  if (cached) {
    cacheBytes -= cached.bytes.length;
    cache.delete(key);
  }
  let redirects = 0;
  for (let attempt = 0; attempt < 3;) {
    trusted(url, allowImageRedirects);
    // One shared start queue keeps both metadata and artwork requests polite.
    const turn = queue.then(async () => {
      await wait(Math.max(0, nextRequestAt - Date.now()), signal);
      signal?.throwIfAborted();
      nextRequestAt = Date.now() + 1100;
    });
    queue = turn.catch(() => {});
    await turn;
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      redirect: "manual",
    });
    if (response.status === 429 || response.status === 503) {
      const retry = response.headers.get("retry-after");
      const retryMs = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now()
        : [2000, 5000, 10000][attempt];
      const delay = Number.isFinite(retryMs) ? Math.max(1100, retryMs) : 5000;
      nextRequestAt = Math.max(nextRequestAt, Date.now() + delay);
      await response.body?.cancel();
      if (++attempt >= 3 || delay > 60000)
        throw new Error(`Provider busy (${response.status}); retry later`);
      continue;
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!allowImageRedirects || !next || ++redirects > 4)
        throw new Error("Unexpected provider redirect");
      url = new URL(next, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Provider unavailable (${response.status}); retry later`);
    }
    if (Number(response.headers.get("content-length")) > limit) {
      await response.body?.cancel();
      throw new Error("Provider response is too large");
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let count = 0;
    try {
      if (reader)
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          count += chunk.value.length;
          if (count > limit) throw new Error("Provider response is too large");
          chunks.push(chunk.value);
        }
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
    signal?.throwIfAborted();
    const result = {
      bytes: Buffer.concat(chunks),
      mime: response.headers.get("content-type") || "",
    };
    if (allowImageRedirects) {
      if (!/^image\/(jpeg|png|webp)(?:;|$)/i.test(result.mime))
        throw new Error("Provider returned an unsupported image");
      const image = await sharp(result.bytes, {
        limitInputPixels: 40000000,
      }).metadata();
      if (
        !["jpeg", "png", "webp"].includes(image.format || "") ||
        !image.width ||
        !image.height ||
        image.width * image.height > 40000000
      )
        throw new Error("Provider returned invalid artwork dimensions");
    } else JSON.parse(result.bytes.toString("utf8"));
    signal?.throwIfAborted();
    if (result.bytes.length <= 5 * 1024 * 1024) {
      while (
        cache.size &&
        (cache.size >= 16 ||
          cacheBytes + result.bytes.length > 16 * 1024 * 1024)
      ) {
        const oldest = cache.keys().next().value!;
        cacheBytes -= cache.get(oldest)!.bytes.length;
        cache.delete(oldest);
      }
      cache.set(key, {
        ...result,
        bytes: Buffer.from(result.bytes),
        expires: Date.now() + (allowImageRedirects ? 86400000 : 7 * 86400000),
      });
      cacheBytes += result.bytes.length;
    }
    return result;
  }
  throw new Error("Provider unavailable; retry later");
}
