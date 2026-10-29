import { _electron, type ElectronApplication } from "@playwright/test";
import { resolve, join, dirname } from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
export async function launch(
  dataDir?: string,
): Promise<{ app: ElectronApplication; dataDir: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "tunevault-e2e-"));
  dataDir ||= join(root, "data");
  await mkdir(dataDir, { recursive: true });
  const executable =
    process.env.TUNEVAULT_EXECUTABLE ||
    resolve(
      process.platform === "darwin"
        ? "dist/mac-arm64/TuneVault.app/Contents/MacOS/TuneVault"
        : "dist/win-unpacked/TuneVault.exe",
    );
  const app = await _electron.launch({
    executablePath: executable,
    args: [],
    env: { ...process.env, TUNEVAULT_E2E: "1", TUNEVAULT_TEST_DATA: dataDir },
    timeout: 30000,
  });
  return { app, dataDir, root };
}
export async function choose(
  app: ElectronApplication,
  path: string,
  action: string,
) {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, path);
  const page = await app.firstWindow();
  return page.evaluate((action) => window.tunevault.invoke(action), action);
}

export async function capture(app: ElectronApplication, file: string) {
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    Array.from(
      (
        await BrowserWindow.getAllWindows()[0].webContents.capturePage(
          undefined,
          { stayHidden: true, stayAwake: true },
        )
      ).toPNG(),
    ),
  );
  if (png.length < 1000) throw new Error("Native renderer capture was empty");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(png));
}

export async function close(app: ElectronApplication) {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      app.close(),
      new Promise<never>((_yes, no) => {
        timer = setTimeout(
          () =>
            no(
              new Error("Packaged application did not quit within 20 seconds"),
            ),
          20000,
        );
      }),
    ]);
  } catch (error) {
    app.process().kill("SIGKILL");
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
