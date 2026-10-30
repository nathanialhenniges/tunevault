# Synthetic audio fixtures

These one-second sine waves were generated locally for TuneVault tests on
2026-10-29. They contain no music, voices, provider content or personal data.
They are supplied under the repository's MIT license.

Generation used FFmpeg 9.0.2, `lavfi sine=frequency=660:duration=1` with libopus and
`sine=frequency=550:duration=1 -ac 2` with the native Vorbis encoder (`-strict -2`). The WebM fixture remuxes the
Opus tone with `-c:a copy`. Tests decode, remux and tag these fixtures using
the bundled, verified tools with no global executable dependency.
