import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { extractFile } from "@electron/asar";

const application = resolve(
  process.argv[2] ||
    (process.platform === "darwin"
      ? `dist/mac${process.arch === "arm64" ? "-arm64" : ""}/TuneVault.app`
      : "dist/win-unpacked"),
);
const resources =
  process.platform === "darwin"
    ? join(application, "Contents/Resources")
    : join(application, "resources");
execFileSync(
  process.execPath,
  ["scripts/verify-tools.mjs", join(resources, "tools")],
  { stdio: "inherit" },
);
const main = extractFile(
  join(resources, "app.asar"),
  join("out", "main", "index.js"),
).toString();
if (process.env.TUNEVAULT_PACKAGE_EXPECT_TEST !== "1")
  assert(
    !main.includes("127.0.0.1:19753"),
    "Production package includes installer-test endpoint",
  );
for (const file of [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "docs/terms-of-use.md",
  "docs/privacy-policy.md",
])
  assert(
    (await stat(join(resources, file))).size > 20,
    `Packaged legal notice missing: ${file}`,
  );
if (process.platform === "darwin") {
  const plist = join(application, "Contents/Info.plist");
  assert.equal(
    process.arch,
    "arm64",
    "Only Apple Silicon Mac packages are supported",
  );
  assert.equal(
    execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", "Print :LSMinimumSystemVersion", plist],
      { encoding: "utf8" },
    ).trim(),
    "15.0",
    "Packaged macOS minimum must be 15.0",
  );
  assert.equal(
    execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", "Print :CFBundleIconName", plist],
      { encoding: "utf8" },
    ).trim(),
    "Icon",
  );
  assert((await stat(join(resources, "Assets.car"))).size > 100_000);
  const catalog = JSON.parse(
    execFileSync(
      "/usr/bin/assetutil",
      ["--info", join(resources, "Assets.car")],
      { encoding: "utf8" },
    ),
  );
  const variants = new Set(
    catalog
      .filter((item) => item.AssetType === "IconImageStack")
      .map((item) => item.Appearance),
  );
  for (const variant of [
    "NSAppearanceNameAqua",
    "NSAppearanceNameDarkAqua",
    "ISAppearanceTintable",
  ])
    assert(variants.has(variant));
} else {
  const configuration = await readFile(
    join(resources, "app-update.yml"),
    "utf8",
  );
  assert(
    !/^\s*publisherName:/m.test(configuration),
    "Unsigned stable updater must not contain stale publisherName",
  );
}
console.log(
  "Packaged sidecars, production updater configuration, notices and native icon verified.",
);
