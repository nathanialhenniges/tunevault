import {
  readdir,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  open,
  rename,
  rm,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join, basename } from "node:path";
const destination = "dist/release-candidate";
await mkdir(destination, { recursive: true });
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (
      /\.(dmg|exe|yml)$/.test(entry.name) ||
      /^evidence-(darwin-arm64|win32-x64)\.json$/.test(entry.name)
    )
      await copyFile(path, join(destination, basename(path)));
  }
}
await collect("dist/downloaded-candidates");
const sourceReviewText =
  process.env.RELEASE_SOURCE_REVIEW_JSON ||
  (await readFile("resources/release-source-review.json", "utf8").catch(
    () => "",
  ));
if (!sourceReviewText)
  throw new Error(
    "A reviewed corresponding-source arrangement is required; no approval was invented",
  );
const sourceReview = JSON.parse(sourceReviewText);
if (sourceReview.schema !== 1 || !sourceReview.platforms)
  throw new Error("Invalid corresponding-source review schema");
const stagedSources = new Set();
for (const platform of ["darwin-arm64", "win32-x64"]) {
  const review = sourceReview.platforms[platform];
  if (
    !review ||
    review.status !== "corresponding-source-reviewed" ||
    !review.sourceArchives?.length
  )
    throw new Error(`Corresponding-source review required for ${platform}`);
  for (const source of review.sourceArchives) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.(?:tar(?:\.gz|\.xz)?|tgz|zip)$/.test(
        source.name,
      ) ||
      !/^[a-f0-9]{64}$/.test(source.sha256)
    )
      throw new Error("Invalid corresponding-source archive identity");
    if (stagedSources.has(source.name)) continue;
    stagedSources.add(source.name);
    const file = join(destination, source.name);
    const hashExisting = createHash("sha256");
    try {
      for await (const chunk of createReadStream(file))
        hashExisting.update(chunk);
      if (hashExisting.digest("hex") === source.sha256) continue;
    } catch {
      /* Fetch the exact reviewed archive when not staged. */
    }
    const url = new URL(source.url);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error(
        "Corresponding-source URL must use HTTPS without credentials",
      );
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!response.ok || !response.body)
      throw new Error("Corresponding-source archive download failed");
    const temporary = file + ".partial",
      output = await open(temporary, "w");
    let size = 0;
    const hash = createHash("sha256");
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 1024 * 1024 * 1024)
          throw new Error("Corresponding-source archive exceeds 1 GiB");
        hash.update(chunk);
        await output.writeFile(chunk);
      }
      await output.close();
      if (!size || hash.digest("hex") !== source.sha256)
        throw new Error("Corresponding-source archive digest mismatch");
      await rename(temporary, file);
    } finally {
      await output.close().catch(() => {});
      await rm(temporary, { force: true });
    }
  }
}
await writeFile(
  join(destination, "source-compliance.json"),
  JSON.stringify(sourceReview, null, 2),
);
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
  await copyFile(name, join(destination, name));
if (!process.env.RELEASE_NOTES?.trim())
  throw new Error("Release notes required");
await writeFile(
  join(destination, "release-notes.md"),
  `${process.env.RELEASE_NOTES.trim()}\n`,
);
