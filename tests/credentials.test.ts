import { test, expect } from "vitest";
import { mkdtemp, readFile, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Credentials, validateCookies } from "../src/main/credentials";
const cookie =
  "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1999999999\tTEST\tSECRET\n";
test("credentials are opt-in, bounded, encrypted at rest and removed on disconnect", async () => {
  const root = await mkdtemp(join(tmpdir(), "tunevault-credential-test-"));
  const data = join(root, "data"),
    temp = join(root, "temp");
  await mkdir(temp);
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: (v: string) => Buffer.from(v.split("").reverse().join("")),
    decryptString: (v: Buffer) => v.toString().split("").reverse().join(""),
  };
  try {
    const service = new Credentials(data, temp, storage);
    expect(await service.initialize()).toBe(null);
    const path = await service.connect(cookie);
    expect(await readFile(path, "utf8")).toBe(cookie);
    expect(
      (await readFile(join(data, "youtube-cookies.enc"), "utf8")).includes(
        "SECRET",
      ),
    ).toBe(false);
    expect(await service.status()).toMatchObject({ connected: true });
    service.clearSessionSync();
    await expect(stat(path)).rejects.toThrow();
    const reopened = new Credentials(data, temp, storage);
    expect(await reopened.initialize()).toBeTruthy();
    await reopened.disconnect();
    expect(await reopened.status()).toMatchObject({ connected: false });
    expect(() =>
      validateCookies(cookie.replace(".youtube.com", ".evil.test")),
    ).toThrow("only YouTube");
    expect(() => validateCookies("SECRET")).toThrow("Netscape");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
