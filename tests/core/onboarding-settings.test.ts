import { it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LibraryService } from "../../src/core/library";
import { CURRENT_DISCLAIMER_VERSION } from "../../src/shared/types";

it("persists validated disclaimer versions and one-time tip acknowledgements", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "tunevault-onboarding-settings-"),
  );
  const options = { dataDir: root, toolsDir: path.join(root, "unused-tools") };
  let service = new LibraryService(options);
  try {
    expect((await service.snapshot()).settings).toMatchObject({
      disclaimerAccepted: false,
      disclaimerVersion: 1,
      onboarded: false,
      tipsSeen: [],
    });
    await service.dispatch("settings.update", {
      disclaimerAccepted: true,
      disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
      tipsSeen: ["import", "playlist", "import"],
    });
    service.close();
    service = new LibraryService(options);
    expect((await service.snapshot()).settings).toMatchObject({
      disclaimerAccepted: true,
      disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
      tipsSeen: ["import", "playlist"],
    });
    for (const value of [0, -1, 1.5, "1", CURRENT_DISCLAIMER_VERSION + 1])
      await expect(
        service.dispatch("settings.update", { disclaimerVersion: value }),
      ).rejects.toThrow("Invalid disclaimer version");
    for (const value of ["import", ["unknown"], [1]])
      await expect(
        service.dispatch("settings.update", { tipsSeen: value }),
      ).rejects.toThrow();
    await service.dispatch("settings.update", { tipsSeen: [] });
    expect((await service.snapshot()).settings.tipsSeen).toEqual([]);
  } finally {
    service.close();
    await rm(root, { recursive: true, force: true });
  }
});

it("fills migration-safe defaults for existing settings without losing preferences or acceptance", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "tunevault-onboarding-legacy-"),
  );
  const options = { dataDir: root, toolsDir: path.join(root, "unused-tools") };
  let service = new LibraryService(options);
  try {
    await service.dispatch("settings.update", {
      appearance: "dark",
      accent: "orange",
      disclaimerAccepted: true,
      onboarded: true,
    });
    const legacy = (await service.snapshot()).settings as Partial<
      Awaited<ReturnType<LibraryService["snapshot"]>>["settings"]
    >;
    delete legacy.disclaimerVersion;
    delete legacy.tipsSeen;
    service.close();
    const database = new DatabaseSync(path.join(root, "library.sqlite"));
    database
      .prepare("UPDATE settings SET data=? WHERE id=1")
      .run(JSON.stringify(legacy));
    database.close();
    service = new LibraryService(options);
    expect((await service.snapshot()).settings).toMatchObject({
      appearance: "dark",
      accent: "orange",
      disclaimerAccepted: true,
      onboarded: true,
      disclaimerVersion: 1,
      tipsSeen: [],
    });
  } finally {
    service.close();
    await rm(root, { recursive: true, force: true });
  }
});
