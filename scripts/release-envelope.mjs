import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist/release-candidate");
const packageJSON = JSON.parse(await readFile("package.json", "utf8"));
const version = packageJSON.version;
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("Stable version required");
if (
  process.env.GITHUB_REF_TYPE === "tag" &&
  process.env.GITHUB_REF_NAME !== `v${version}`
)
  throw new Error("Tag/package version mismatch");
if (!process.env.RELEASE_SIGN_PRIVATE_KEY)
  throw new Error(
    "Set RELEASE_SIGN_PRIVATE_KEY only in the protected release-signing environment",
  );
const privateKey = createPrivateKey(process.env.RELEASE_SIGN_PRIVATE_KEY);
if (privateKey.asymmetricKeyType !== "ed25519")
  throw new Error("Ed25519 signing key required");
const configured = JSON.parse(
  await readFile("resources/update-keys.json", "utf8"),
);
const derived = createPublicKey(privateKey)
  .export({ format: "pem", type: "spki" })
  .toString();
if (
  !Array.isArray(configured.publicKeys) ||
  !configured.publicKeys.includes(derived)
)
  throw new Error("Release key does not match a committed trusted public key");
const assets = {};
for (const [platform, arch, os, extension] of [
  ["darwin", "arm64", "mac", "dmg"],
  ["darwin", "x64", "mac", "dmg"],
  ["win32", "x64", "win", "exe"],
]) {
  const name = `TuneVault-${version}-${os}-${arch}.${extension}`;
  const bytes = await readFile(join(root, name));
  if (!bytes.length) throw new Error("Empty artifact");
  assets[`${platform}-${arch}`] = {
    name,
    url: `https://github.com/nathanialhenniges/tunevault/releases/download/v${version}/${name}`,
    size: bytes.length,
    sha512: createHash("sha512").update(bytes).digest("base64"),
  };
}
const notes = await readFile(join(root, "release-notes.md"), "utf8");
if (notes.length > 40_000)
  throw new Error("Release notes exceed envelope bound");
const bytes = Buffer.from(
  `${JSON.stringify({ schema: 1, version, channel: "stable", minimumOS: { darwin: "14.0.0", win32: "10.0.19045" }, notes, assets }, null, 2)}\n`,
);
const signature = sign(null, bytes, privateKey);
if (!verify(null, bytes, derived, signature))
  throw new Error("Signing self-check failed");
await writeFile(join(root, "release-envelope.json"), bytes);
await writeFile(
  join(root, "release-envelope.sig"),
  `${signature.toString("base64")}\n`,
);
console.log(
  `Signed complete release envelope ${version}. Nothing was uploaded.`,
);
