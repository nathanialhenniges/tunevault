import { it, expect } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
const run = promisify(execFile);
it("requires exact production installer smoke and separately identified upgrade fixtures", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-release-gate-"));
  const candidate = path.join(root, "candidate");
  await mkdir(candidate);
  await mkdir(path.join(root, "resources"));
  const keys = generateKeyPairSync("ed25519");
  const publicKey = keys.publicKey
    .export({ format: "pem", type: "spki" })
    .toString();
  const script = path.resolve("scripts/check-release.mjs");
  try {
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ version: "4.0.0" }),
    );
    await writeFile(
      path.join(root, "resources/update-keys.json"),
      JSON.stringify({ publicKeys: [publicKey] }),
    );
    const assets: Record<
      string,
      { name: string; url: string; size: number; sha512: string }
    > = {};
    for (const [platform, os, arch, ext] of [
      ["darwin", "mac", "arm64", "dmg"],
      ["darwin", "mac", "x64", "dmg"],
      ["win32", "win", "x64", "exe"],
    ]) {
      const name = `TuneVault-4.0.0-${os}-${arch}.${ext}`;
      const bytes = Buffer.from(
        `Synthetic installer fixture for ${platform}-${arch}; never executed.`,
      );
      const artifact = {
        name,
        size: bytes.length,
        sha512: createHash("sha512").update(bytes).digest("base64"),
      };
      assets[`${platform}-${arch}`] = {
        ...artifact,
        url: `https://github.com/nathanialhenniges/tunevault/releases/download/v4.0.0/${name}`,
      };
      await writeFile(path.join(candidate, name), bytes);
      await writeFile(
        path.join(candidate, `evidence-${platform}-${arch}.json`),
        JSON.stringify({
          platform: `${platform}-${arch}`,
          version: "4.0.0",
          packaged: true,
          productionInstallerSmoke: true,
          installedUpgrade: true,
          artifact,
          upgradeFixtures: {
            from: {
              ...artifact,
              sha512: createHash("sha512")
                .update("disposable-key N fixture")
                .digest("base64"),
            },
            to: {
              ...artifact,
              name: name.replace("4.0.0", "4.0.1"),
              sha512: createHash("sha512")
                .update("disposable-key N+1 fixture")
                .digest("base64"),
            },
          },
        }),
      );
    }
    const envelope = Buffer.from(
      JSON.stringify({
        schema: 1,
        channel: "stable",
        version: "4.0.0",
        assets,
      }),
    );
    await writeFile(path.join(candidate, "release-envelope.json"), envelope);
    await writeFile(
      path.join(candidate, "release-envelope.sig"),
      sign(null, envelope, keys.privateKey).toString("base64"),
    );
    for (const file of [
      "LICENSE",
      "THIRD_PARTY_NOTICES.md",
      "release-notes.md",
    ])
      await writeFile(
        path.join(candidate, file),
        "Synthetic release-gate fixture content only; no release is published.\n",
      );
    await expect(
      run(process.execPath, [script, candidate], { cwd: root }),
    ).resolves.toMatchObject({ stderr: "" });
    const evidenceFile = path.join(candidate, "evidence-darwin-arm64.json");
    const good = JSON.parse(await readFile(evidenceFile, "utf8"));
    for (const bad of [
      { ...good, productionInstallerSmoke: false },
      { ...good, upgradeFixtures: undefined },
      {
        ...good,
        artifact: { ...good.artifact, sha512: "unrelated installer" },
      },
      {
        ...good,
        upgradeFixtures: {
          ...good.upgradeFixtures,
          to: good.upgradeFixtures.from,
        },
      },
    ]) {
      await writeFile(evidenceFile, JSON.stringify(bad));
      await expect(
        run(process.execPath, [script, candidate], { cwd: root }),
      ).rejects.toThrow();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
