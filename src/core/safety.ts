import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
export function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object");
  return value as Record<string, any>;
}
export function text(value: unknown, max = 1000): string {
  if (typeof value !== "string" || value.length > max || value.includes("\0"))
    throw new Error("Invalid text");
  return value;
}
export function ids(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 10000 ||
    value.some((x) => typeof x !== "string" || x.length > 100)
  )
    throw new Error("Invalid selection");
  return value;
}
export function safeName(value: string): string {
  let name = value
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex -- Windows filenames cannot contain control characters.
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    name = `_${name}`;
  return name || "Untitled";
}
export async function confined(
  root: string,
  relative: string,
): Promise<string> {
  if (
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((x) => x === "..")
  )
    throw new Error("Unsafe relative path");
  const base = await realpath(root);
  const result = path.resolve(base, relative);
  if (!result.startsWith(base + path.sep))
    throw new Error("Path escapes selected root");
  let parent = path.dirname(result);
  while (parent !== base) {
    try {
      const resolved = await realpath(parent);
      if (resolved !== base && !resolved.startsWith(base + path.sep))
        throw new Error("Symlink escapes selected root");
      break;
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    parent = path.dirname(parent);
  }
  try {
    if ((await lstat(result)).isSymbolicLink())
      throw new Error("Symlink output is not allowed");
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
  }
  return result;
}
export async function hashFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export function youtubeUrl(value: unknown): string {
  const url = new URL(text(value, 2000));
  if (
    url.protocol !== "https:" ||
    ![
      "youtube.com",
      "www.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Use an HTTPS YouTube video or playlist URL");
  const id =
    url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v");
  const list = url.searchParams.get("list");
  if (id && /^[\w-]{11}$/.test(id))
    return `https://www.youtube.com/watch?v=${id}`;
  if (list && /^[\w-]{10,100}$/.test(list))
    return `https://www.youtube.com/playlist?list=${list}`;
  throw new Error("Invalid YouTube video or playlist ID");
}
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
