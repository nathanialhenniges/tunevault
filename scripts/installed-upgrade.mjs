import { spawnSync, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, list) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), list[index + 1]]);
    return pairs;
  }, []),
);
const platform = args.platform || process.platform;
if (platform !== process.platform || !["darwin", "win32"].includes(platform))
  throw new Error("Installer upgrades must run natively on a supported OS");
if (!args.from || !args.to)
  throw new Error(
    "Usage: node scripts/installed-upgrade.mjs --from <N installer> --to <N+1 installer>",
  );
const root = await mkdtemp(join(tmpdir(), "tunevault-installed-upgrade-"));
const data = join(root, "userData");
const installation = join(root, "installed");
await mkdir(data);
await mkdir(installation);
const test = async (executable, phase, selectedData = data) => {
  const child = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/e2e/installed.spec.ts",
    ],
    {
      stdio: "inherit",
      timeout: 180_000,
      env: {
        ...process.env,
        TUNEVAULT_EXECUTABLE: executable,
        TUNEVAULT_TEST_DATA: selectedData,
        TUNEVAULT_E2E: "1",
        TUNEVAULT_UPGRADE_PHASE: phase,
        TUNEVAULT_PRODUCTION_VERSION: JSON.parse(
          await readFile("package.json", "utf8"),
        ).version,
      },
    },
  );
  if (child.status !== 0)
    throw new Error(`Installed ${phase} E2E failed (${child.status})`);
};
async function installDMG(path) {
  const mount = join(root, "mounted");
  await mkdir(mount, { recursive: true });
  execFileSync(
    "/usr/bin/hdiutil",
    ["attach", "-nobrowse", "-readonly", "-mountpoint", mount, resolve(path)],
    { stdio: "inherit", timeout: 120_000 },
  );
  try {
    const destination = join(installation, "TuneVault.app");
    await rm(destination, { recursive: true, force: true });
    execFileSync(
      "/usr/bin/ditto",
      [join(mount, "TuneVault.app"), destination],
      { stdio: "inherit", timeout: 120_000 },
    );
    return join(destination, "Contents/MacOS/TuneVault");
  } finally {
    execFileSync("/usr/bin/hdiutil", ["detach", mount], {
      stdio: "inherit",
      timeout: 30_000,
    });
  }
}
async function identity(file) {
  const digest = createHash("sha512");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return {
    name: file.split(/[\\/]/).pop(),
    size: (await stat(file)).size,
    sha512: digest.digest("base64"),
  };
}
async function uninstallWindows() {
  execFileSync(join(installation, "Uninstall TuneVault.exe"), ["/S"], {
    stdio: "inherit",
    timeout: 120_000,
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await stat(join(installation, "TuneVault.exe"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "NSIS uninstall did not remove the isolated installed executable",
  );
}
try {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const candidateName = `TuneVault-${pkg.version}-${platform === "darwin" ? "mac" : "win"}-${process.arch}.${platform === "darwin" ? "dmg" : "exe"}`;
  const production = resolve(args.production || join("dist", candidateName));
  const artifact = await identity(production);
  const upgradeFixtures = {
    from: await identity(resolve(args.from)),
    to: await identity(resolve(args.to)),
  };
  const productionData = join(root, "production-userData");
  await mkdir(productionData);
  if (platform === "darwin")
    await test(await installDMG(production), "production", productionData);
  else {
    execFileSync(production, ["/S", `/D=${installation}`], {
      stdio: "inherit",
      timeout: 120_000,
    });
    await test(
      join(installation, "TuneVault.exe"),
      "production",
      productionData,
    );
    await uninstallWindows();
    if (
      !(await readFile(join(productionData, "upgrade-assertions.json"), "utf8"))
        .length
    )
      throw new Error("Production uninstall did not retain isolated user data");
  }
  if (platform === "darwin") {
    await test(await installDMG(args.from), "seed");
    await test(await installDMG(args.to), "verify");
  } else {
    execFileSync(resolve(args.from), ["/S", `/D=${installation}`], {
      stdio: "inherit",
      timeout: 120_000,
    });
    const executable = join(installation, "TuneVault.exe");
    await test(executable, "seed");
    // The E2E authenticated-update phase must host a disposable signed envelope and invoke production update commands.
    const child = spawnSync(
      process.execPath,
      [
        "scripts/windows-loopback-upgrade.mjs",
        "--installed",
        executable,
        "--installer",
        resolve(args.to),
        "--data",
        data,
      ],
      { stdio: "inherit", timeout: 240_000, env: process.env },
    );
    if (child.status !== 0)
      throw new Error("Authenticated installed NSIS update failed");
    await test(executable, "verify");
    await uninstallWindows();
    if (!(await readFile(join(data, "upgrade-assertions.json"), "utf8")).length)
      throw new Error("Uninstall did not retain expected user data");
  }
  if (JSON.stringify(await identity(production)) !== JSON.stringify(artifact))
    throw new Error("Production installer changed after its smoke test");
  const evidence = {
    platform: `${platform}-${process.arch}`,
    version: pkg.version,
    packaged: true,
    productionInstallerSmoke: true,
    installedUpgrade: true,
    artifact,
    upgradeFixtures,
    timestamp: new Date().toISOString(),
    method:
      platform === "darwin"
        ? "Exact production DMG install/media smoke; separate test-fixture DMG N->N+1 manual replacement"
        : "Exact production NSIS install/media smoke/uninstall retains data; separate disposable-key fixture authenticated N->N+1 update",
  };
  await mkdir("test-results", { recursive: true });
  await writeFile(
    `test-results/evidence-${platform}-${process.arch}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    "Exact production installer smoke and separate installed-upgrade fixture checks passed.",
  );
} finally {
  if (process.env.TUNEVAULT_KEEP_UPGRADE_FIXTURE !== "1")
    await rm(root, { recursive: true, force: true });
}
