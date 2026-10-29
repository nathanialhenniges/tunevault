import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileGrants } from "../src/main/permissions";
describe("native file grants", () => {
  it("rejects arbitrary paths and changed symlink destinations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tunevault-grants-"));
    try {
      await mkdir(join(dir, "a"));
      await mkdir(join(dir, "b"));
      await symlink(join(dir, "a"), join(dir, "link"));
      const grants = new FileGrants();
      await expect(grants.require(join(dir, "b"))).rejects.toThrow(
        "not selected",
      );
      await grants.grant(join(dir, "link"));
      await grants.require(join(dir, "link"));
      await rm(join(dir, "link"));
      await symlink(join(dir, "b"), join(dir, "link"));
      await expect(grants.require(join(dir, "link"))).rejects.toThrow(
        "not selected",
      );
      await grants.grant(join(dir, "backup.json"), true);
      await grants.require(join(dir, "backup.json"), true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
