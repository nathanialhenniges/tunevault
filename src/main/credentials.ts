import { rmSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { join, dirname, basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";
export interface SecretStore {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
export function validateCookies(value: string): void {
  if (
    Buffer.byteLength(value) > 1024 * 1024 ||
    !/^# (?:Netscape HTTP Cookie File|HTTP Cookie File)/.test(value)
  )
    throw new Error(
      "Select an exported Netscape cookies.txt file (maximum 1 MB)",
    );
  const rows = value
    .split(/\r?\n/)
    .filter(
      (line) =>
        line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")),
    );
  if (!rows.length) throw new Error("The cookie file has no cookies");
  for (const line of rows) {
    const fields = line.replace(/^#HttpOnly_/, "").split("\t");
    if (
      fields.length !== 7 ||
      !/^\.?((www|music|accounts)\.)?(youtube|google)\.com$/.test(fields[0])
    )
      throw new Error(
        "Use a file containing only YouTube/Google cookies; do not import a whole browser cookie collection",
      );
  }
}
export class Credentials {
  private session: string | null = null;
  constructor(
    private dataDir: string,
    private tempDir: string,
    private storage: SecretStore,
  ) {}
  private get encrypted() {
    return join(this.dataDir, "youtube-cookies.enc");
  }
  async status() {
    return {
      connected: this.session !== null && this.storage.isEncryptionAvailable(),
      secureStorage: this.storage.isEncryptionAvailable(),
    };
  }
  async initialize(): Promise<string | null> {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    try {
      const previous = JSON.parse(
        await readFile(join(this.dataDir, "credential-session.json"), "utf8"),
      );
      if (
        typeof previous.path === "string" &&
        dirname(resolve(previous.path)) === resolve(this.tempDir) &&
        basename(previous.path).startsWith("tunevault-credential-")
      )
        await rm(previous.path, { recursive: true, force: true });
    } catch {
      /* No prior session or malformed cleanup marker. */
    }
    await rm(join(this.dataDir, "credential-session.json"), { force: true });
    if (!this.storage.isEncryptionAvailable()) return null;
    try {
      return await this.materialize(
        this.storage.decryptString(await readFile(this.encrypted)),
      );
    } catch {
      return null;
    }
  }
  async connect(value: string): Promise<string> {
    if (!this.storage.isEncryptionAvailable())
      throw new Error("Operating-system secure storage is unavailable");
    validateCookies(value);
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const temporary = join(this.dataDir, `credentials-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, this.storage.encryptString(value), {
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporary, this.encrypted);
    } finally {
      await rm(temporary, { force: true });
    }
    return this.materialize(value);
  }
  private async materialize(value: string) {
    validateCookies(value);
    await this.clearSession();
    this.session = await mkdtemp(join(this.tempDir, "tunevault-credential-"));
    await writeFile(
      join(this.dataDir, "credential-session.json"),
      JSON.stringify({ path: this.session }),
      { mode: 0o600 },
    );
    const file = join(this.session, "cookies.txt");
    await writeFile(file, value, { flag: "wx", mode: 0o600 });
    return file;
  }
  async clearSession() {
    if (this.session) {
      await rm(this.session, { recursive: true, force: true });
      this.session = null;
    }
    await rm(join(this.dataDir, "credential-session.json"), { force: true });
  }
  clearSessionSync() {
    if (this.session) {
      rmSync(this.session, { recursive: true, force: true });
      this.session = null;
    }
    rmSync(join(this.dataDir, "credential-session.json"), { force: true });
  }
  async disconnect() {
    await this.clearSession();
    await rm(this.encrypted, { force: true });
  }
}
