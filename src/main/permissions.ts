import { realpath, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
export class FileGrants {
  private paths = new Set<string>();
  async grant(path: string, save = false) {
    const canonical = save
      ? resolve(await realpath(dirname(path)), basename(path))
      : await realpath(path);
    this.paths.add(canonical);
    return canonical;
  }
  async require(path: unknown, save = false) {
    if (typeof path !== "string" || !path || path.includes("\0"))
      throw new Error("Choose a file or folder first");
    const canonical = save
      ? resolve(await realpath(dirname(path)), basename(path))
      : await realpath(path);
    if (!this.paths.has(canonical))
      throw new Error(
        "This location was not selected in a native dialog or dropped by you",
      );
    if (!save) await stat(canonical);
  }
}
