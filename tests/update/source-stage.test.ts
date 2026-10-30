import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
it("stages only an explicit source review and digest-verified corresponding-source archives", async () => {
  const root = await mkdtemp(join(tmpdir(), "tunevault-source-stage-"));
  const candidate = join(root, "dist/release-candidate");
  try {
    await mkdir(join(root, "dist/downloaded-candidates"), { recursive: true });
    await mkdir(candidate, { recursive: true });
    for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
      await writeFile(
        join(root, name),
        "Synthetic legal-gate test fixture, not legal approval.",
      );
    const script = resolve("scripts/stage-release.mjs");
    const env = {
      ...process.env,
      RELEASE_NOTES: "Synthetic fixture",
      RELEASE_SOURCE_REVIEW_JSON: "",
    };
    await expect(
      run(process.execPath, [script], { cwd: root, env }),
    ).rejects.toThrow("reviewed corresponding-source arrangement");
    const bytes = Buffer.from(
      "Synthetic source archive fixture; not real tool source.",
    );
    await writeFile(join(candidate, "synthetic.tar"), bytes);
    const review = {
      schema: 1,
      platforms: Object.fromEntries(
        ["darwin-arm64", "win32-x64"].map((platform) => [
          platform,
          {
            status: "corresponding-source-reviewed",
            reviewedBy: "Synthetic test reviewer",
            reviewedAt: "2026-10-30T00:00:00Z",
            artifactSha512: "fixture",
            sourceArchives: [
              {
                name: "synthetic.tar",
                sha256: createHash("sha256").update(bytes).digest("hex"),
                url: "http://forbidden.invalid/source",
              },
            ],
          },
        ]),
      ),
    };
    env.RELEASE_SOURCE_REVIEW_JSON = JSON.stringify(review);
    await expect(
      run(process.execPath, [script], { cwd: root, env }),
    ).resolves.toMatchObject({ stderr: "" });
    expect(
      JSON.parse(
        await readFile(join(candidate, "source-compliance.json"), "utf8"),
      ),
    ).toEqual(review);
    await writeFile(join(candidate, "synthetic.tar"), "Corrupted cache");
    await expect(
      run(process.execPath, [script], { cwd: root, env }),
    ).rejects.toThrow("HTTPS");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
