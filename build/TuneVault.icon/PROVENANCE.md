# TuneVault icon source

The wolf layer is an unchanged copy of the generated TuneVault concept PNG supplied by Nathanial Henniges. Its original PNG metadata and provenance are preserved in `Assets/wolf-concept.png` and `resources/icon.png`.

The Icon Composer document adds a native neutral silver or charcoal background, system glass material, a restrained shadow, and a centered foreground scale of 0.68. The original artwork colors remain unchanged in the default and dark appearances. macOS supplies its own tinted appearance.

The native macOS icon is compiled from this document with Apple's `actool` through electron-builder 26.18.0. The resulting `Assets.car` and `CFBundleIconName` support macOS 26 appearance variants; the same compiler emits a legacy ICNS fallback for older systems. Preview PNGs are tool exports, not source replacements.
