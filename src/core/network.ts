const userAgent =
  "TuneVault/4.0.0 (https://github.com/nathanialhenniges/tunevault)";
export async function fetchBounded(
  url: URL,
  limit: number,
  allowImageRedirects = false,
): Promise<{ bytes: Buffer; mime: string }> {
  for (let redirects = 0; redirects <= 4; redirects++) {
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
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!allowImageRedirects || !next)
        throw new Error("Unexpected provider redirect");
      url = new URL(next, url);
      continue;
    }
    if (!response.ok)
      throw new Error(`Provider unavailable (${response.status}); retry later`);
    if (Number(response.headers.get("content-length")) > limit) {
      await response.body?.cancel();
      throw new Error("Provider response is too large");
    }
    const chunks: Uint8Array[] = [];
    let count = 0;
    if (response.body)
      for await (const chunk of response.body) {
        count += chunk.length;
        if (count > limit) {
          await response.body.cancel().catch(() => {});
          throw new Error("Provider response is too large");
        }
        chunks.push(chunk);
      }
    return {
      bytes: Buffer.concat(chunks),
      mime: response.headers.get("content-type") || "",
    };
  }
  throw new Error("Too many provider redirects");
}
