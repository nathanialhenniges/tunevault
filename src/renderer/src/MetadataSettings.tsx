import { useState } from "react";
import type { Settings } from "../../shared/types";
import type { Run } from "./Inspector";
import { message } from "./ui";

export default function MetadataSettings({
  settings,
  run,
}: {
  settings: Settings;
  run: Run;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const online = settings.metadataOnline ?? true;
  const services = {
    musicbrainz: true,
    coverArtArchive: true,
    ...settings.metadataServices,
  };
  async function save(changes: Partial<Settings>) {
    setBusy(true);
    setError("");
    try {
      await run("settings.update", changes);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section" aria-labelledby="metadata-settings-title">
      <h2 id="metadata-settings-title">Metadata &amp; artwork</h2>
      <p className="muted">
        Lookups happen when you request them. Review suggestions before
        applying; your original files stay unchanged.
      </p>
      <label className="check-line">
        <input
          type="checkbox"
          checked={online}
          disabled={busy}
          onChange={(event) =>
            void save({ metadataOnline: event.target.checked })
          }
        />
        Online metadata and artwork lookups
      </label>
      <p className="muted">
        Turn off to stop metadata requests, including pending requests. Music
        imports and exports still work. Online sources and updates have separate
        controls.
      </p>
      <label className="check-line">
        <input
          type="checkbox"
          checked={services.musicbrainz}
          disabled={busy || !online}
          onChange={(event) =>
            void save({
              metadataServices: {
                ...services,
                musicbrainz: event.target.checked,
              },
            })
          }
        />
        MusicBrainz
      </label>
      <p className="muted">
        Sends title and artist, your IP address and the TuneVault version to
        suggest tags. Core metadata is CC0.
      </p>
      <label className="check-line">
        <input
          type="checkbox"
          checked={services.coverArtArchive}
          disabled={busy || !online}
          onChange={(event) =>
            void save({
              metadataServices: {
                ...services,
                coverArtArchive: event.target.checked,
              },
            })
          }
        />
        Cover Art Archive
      </label>
      <p className="muted">
        Sends a release ID, your IP address and the TuneVault version to request
        artwork up to 1200 pixels. Images belong to their copyright owners.
      </p>
      {!settings.onlineAcknowledged && (
        <p className="muted">
          The separate network notice must also be accepted before a lookup can
          run.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
