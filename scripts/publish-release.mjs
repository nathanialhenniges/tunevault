import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const tag = `v${pkg.version}`;
const root = resolve("dist/release-candidate");
const entries = await readdir(root);
execFileSync(
  "gh",
  [
    "release",
    "create",
    tag,
    "--repo",
    "nathanialhenniges/tunevault",
    "--verify-tag",
    "--title",
    `TuneVault ${pkg.version}`,
    "--notes-file",
    join(root, "release-notes.md"),
    ...entries.map((name) => join(root, name)),
  ],
  { stdio: "inherit" },
);
const probe = await mkdtemp(join(tmpdir(), "tunevault-release-probe-"));
try {
  execFileSync(
    "gh",
    [
      "release",
      "download",
      tag,
      "--repo",
      "nathanialhenniges/tunevault",
      "--dir",
      probe,
    ],
    { stdio: "inherit" },
  );
  execFileSync(process.execPath, ["scripts/check-release.mjs", probe], {
    stdio: "inherit",
  });
} finally {
  await rm(probe, { recursive: true, force: true });
}
