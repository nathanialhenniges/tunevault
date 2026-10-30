import { createHash, verify } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist/release-candidate");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const bytes = await readFile(join(root, "release-envelope.json"));
const signature = Buffer.from(
  (await readFile(join(root, "release-envelope.sig"), "utf8")).trim(),
  "base64",
);
const { publicKeys } = JSON.parse(
  await readFile("resources/update-keys.json", "utf8"),
);
if (
  !publicKeys.length ||
  signature.length !== 64 ||
  !publicKeys.some((key) => verify(null, bytes, key, signature))
)
  throw new Error("Production release signature missing/invalid");
const envelope = JSON.parse(bytes);
const sourceCompliance = JSON.parse(
  await readFile(join(root, "source-compliance.json"), "utf8"),
);
if (sourceCompliance.schema !== 1)
  throw new Error("Corresponding-source review schema missing");
if (
  envelope.schema !== 1 ||
  envelope.channel !== "stable" ||
  envelope.version !== pkg.version
)
  throw new Error("Release/package schema or version mismatch");
for (const platform of ["darwin-arm64", "darwin-x64", "win32-x64"]) {
  const asset = envelope.assets[platform];
  if (!asset || !/^[A-Za-z0-9._-]+$/.test(asset.name))
    throw new Error(`Missing ${platform} artifact`);
  const review = sourceCompliance.platforms?.[platform];
  if (
    !review ||
    review.artifactSha512 !== asset.sha512 ||
    review.status !== "corresponding-source-reviewed" ||
    typeof review.reviewedBy !== "string" ||
    !review.reviewedBy.trim() ||
    !Number.isFinite(Date.parse(review.reviewedAt)) ||
    !Array.isArray(review.sourceArchives) ||
    !review.sourceArchives.length
  )
    throw new Error(
      `Corresponding-source review absent or for different artifact: ${platform}`,
    );
  for (const source of review.sourceArchives) {
    if (
      !source ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(source.name) ||
      !/^[a-f0-9]{64}$/.test(source.sha256)
    )
      throw new Error(`Invalid corresponding-source identity: ${platform}`);
    const sourceBytes = await readFile(join(root, source.name));
    if (
      !sourceBytes.length ||
      createHash("sha256").update(sourceBytes).digest("hex") !== source.sha256
    )
      throw new Error(
        `Corresponding-source archive missing or changed: ${platform}/${source.name}`,
      );
  }
  if (
    asset.url !==
    `https://github.com/nathanialhenniges/tunevault/releases/download/v${pkg.version}/${asset.name}`
  )
    throw new Error("Wrong artifact URL");
  const file = await readFile(join(root, asset.name));
  if (
    file.length !== asset.size ||
    createHash("sha512").update(file).digest("base64") !== asset.sha512
  )
    throw new Error(`Wrong ${platform} hash/size`);
  const evidence = JSON.parse(
    await readFile(join(root, `evidence-${platform}.json`), "utf8"),
  );
  if (
    evidence.version !== pkg.version ||
    evidence.platform !== platform ||
    evidence.packaged !== true ||
    evidence.productionInstallerSmoke !== true ||
    evidence.installedUpgrade !== true
  )
    throw new Error(
      `Required native production installer/packaging/upgrade evidence absent: ${platform}`,
    );
  if (
    JSON.stringify(evidence.artifact) !==
    JSON.stringify({ name: asset.name, size: asset.size, sha512: asset.sha512 })
  )
    throw new Error(`Native evidence is for a different artifact: ${platform}`);
  for (const phase of ["from", "to"]) {
    const fixture = evidence.upgradeFixtures?.[phase];
    if (
      !fixture ||
      !Number.isSafeInteger(fixture.size) ||
      fixture.size < 1 ||
      !/^[A-Za-z0-9+/]{86}==$/.test(fixture.sha512) ||
      !/^TuneVault-\d+\.\d+\.\d+-(mac|win)-(arm64|x64)\.(dmg|exe)$/.test(
        fixture.name,
      )
    )
      throw new Error(
        `Missing explicit installed-upgrade fixture identity: ${platform}/${phase}`,
      );
  }
  if (evidence.upgradeFixtures.from.name === evidence.upgradeFixtures.to.name)
    throw new Error(`Upgrade fixtures do not advance a version: ${platform}`);
}
for (const file of ["THIRD_PARTY_NOTICES.md", "LICENSE", "release-notes.md"])
  if ((await stat(join(root, file))).size < 20)
    throw new Error(`Missing ${file}`);
console.log(
  `Release ${pkg.version} candidate signature, matrix evidence, and all artifacts verified. Nothing was published.`,
);
