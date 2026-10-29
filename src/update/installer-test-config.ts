import { NsisUpdater } from "electron-updater";
import keys from "../../tests/fixtures/update-test-public.json";

// Imported only by a separate installer-test build; production config has no endpoint override.
export function updateOptions() {
  return {
    publicKeys: keys.publicKeys,
    transport: async (
      url: string,
      max: number,
      signal?: AbortSignal,
    ): Promise<Buffer> => {
      const name = new URL(url).pathname.split("/").pop();
      if (!["release-envelope.json", "release-envelope.sig"].includes(name!))
        throw new Error("Unexpected installer-test metadata request");
      const response = await fetch(`http://127.0.0.1:19753/${name}`, {
        signal,
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(`Installer-test request failed ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > max)
        throw new Error("Installer-test response too large");
      return bytes;
    },
    windowsUpdater: async () =>
      new NsisUpdater({ provider: "generic", url: "http://127.0.0.1:19753/" }),
  };
}
