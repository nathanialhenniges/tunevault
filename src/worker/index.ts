import { LibraryService } from "../core/library";
import { stopMediaTools } from "../core/media";
import { CURRENT_DISCLAIMER_VERSION } from "../shared/types";
const port = process.parentPort;
if (!port) throw new Error("Library must run in a utility process");
let service: LibraryService;
port.on("message", async ({ data }: { data: any }) => {
  const { id, action, input } = data;
  try {
    if (action === "__init") {
      service = new LibraryService(input);
      port.postMessage({
        id,
        result: { node: process.versions.node, sqlite: true },
      });
    } else if (action === "__shutdown") {
      service?.close();
      await stopMediaTools();
      port.postMessage({ id, result: true });
    } else if (action === "__cookies") {
      service.setCookieFile(input?.path ?? null);
      const { settings } = await service.snapshot();
      if (
        settings.disclaimerAccepted &&
        settings.disclaimerVersion >= CURRENT_DISCLAIMER_VERSION
      )
        service.resumeQueued();
      port.postMessage({ id, result: true });
    } else {
      if (!service) throw new Error("Library is not ready");
      const result = await service.dispatch(action, input);
      if (action === "settings.update") {
        const { settings } = await service.snapshot();
        if (
          settings.disclaimerAccepted &&
          settings.disclaimerVersion >= CURRENT_DISCLAIMER_VERSION
        )
          service.resumeQueued();
      }
      port.postMessage({ id, result });
      if (
        ![
          "snapshot",
          "artwork.get",
          "artwork.placeholderPreview",
          "lookup.cancel",
          "lookup.artworkPreview",
          "artwork.preview",
          "import.preview",
          "export.preview",
          "source.preview",
          "source.search",
          "lookup.search",
          "mixes.parse",
          "diagnostics",
          "playlists.refreshPreview",
        ].includes(action)
      )
        port.postMessage({ changed: true });
    }
  } catch (error) {
    port.postMessage({
      id,
      error: error instanceof Error ? error.message : "Operation failed",
    });
  }
});

process.on("SIGTERM", () => {
  service?.close();
  setTimeout(() => process.exit(0), 300);
});
