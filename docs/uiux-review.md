# UI/UX Review: TuneVault

**Reviewed:** 2026-06-16 · **Input:** screenshot + local code (`src/renderer/src/`) · **Method:** NN/g heuristic evaluation + token/contrast measurement

## Executive summary
- Clean, calm dark UI with restrained accent use and clear primary hierarchy; the macOS vibrancy reads well in the supplied screenshot.
- **Single worst problem:** the `--text-muted` token fails WCAG AA contrast in **both** themes, and it's used for meaningful secondary info (artist names, track durations, playlist labels, device paths) — not just decoration. Translucent vibrancy makes this worse.
- Type sizes are desktop-appropriate; one control label (10px) is below a comfortable floor.

**Findings:** 🟥 0 catastrophic · 🟧 1 major · 🟨 2 minor · ⬜ 1 cosmetic

## Findings

### 🟧 Severity 3 — Major
#### 1. `--text-muted` text fails AA contrast (both themes)
- **What:** Dark `--text-muted` `#52525b` on `--bg-base` `#09090b` ≈ **2.4:1**. Light `--text-muted` `#a1a1aa` on `#ffffff` ≈ **2.6:1**. WCAG AA needs 4.5:1 (3:1 for large text). Used for artist names, durations, the "Imported"/playlist labels, device folder paths, version — all meaningful, non-decorative text. Over macOS vibrancy the effective contrast drops further.
- **Where:** `src/renderer/src/styles/index.css` (`--text-muted` in `:root` and `.dark`); consumed via `text-text-muted` across TrackList rows, Sidebar, Device cards, PlayerBar.
- **Guideline:** Legibility — body text needs ≥4.5:1.
- **Evidence:** [Ensure High Contrast for Text Over Images](https://www.nngroup.com/articles/text-over-images/) — non-decorative text should be ≥4.5:1 (3:1 for large). [Low-Contrast Text Is Not the Answer](https://www.nngroup.com/articles/low-contrast/) — low-contrast UI text is illegible and inaccessible. (WCAG 1.4.3.)
- **Fix:**
  - [x] Dark `--text-muted` → `#76767f` (~4.5:1), preserving the step below `--text-secondary` (#a1a1aa, ~7.5:1).
  - [x] Light `--text-muted` → `#71717a` (~4.8:1).

### 🟨 Severity 2 — Minor
#### 2. 10px control label below legibility floor
- **What:** The crossfade label uses `text-[10px]`. 10px is below a comfortable minimum for interactive labels.
- **Where:** `src/renderer/src/components/player/PlayerBar.tsx` (crossfade `CF`/`Ns` button).
- **Guideline:** Legibility — characters must be recognizable.
- **Evidence:** [Legibility, Readability, and Comprehension](https://www.nngroup.com/articles/legibility-readability-comprehension/) — legibility is whether users can distinguish characters at all.
- **Fix:**
  - [x] Bump to `text-[11px]`.

#### 3. Text over vibrancy has no guaranteed backing (wallpaper-dependent)
- **What:** With `body` transparent on macOS, content text sits directly over the frosted material. `under-window` vibrancy is dark, so it's fine on most wallpapers, but a very bright wallpaper can erode contrast.
- **Where:** `.is-mac body` (index.css) + `main` content area.
- **Guideline:** High contrast for text over variable backgrounds.
- **Evidence:** [Ensure High Contrast for Text Over Images](https://www.nngroup.com/articles/text-over-images/) — keep text legible over non-uniform backgrounds.
- **Fix (held — revisit if it reads poorly):**
  - [ ] If needed, add a faint scrim behind the content area (e.g. `rgba(9,9,11,0.3)`) while keeping the sidebar/chrome fully vibrant.

### ⬜ Severity 1 — Cosmetic
#### 4. Dense rows use 12px where 13px reads better
- **What:** Several list/secondary texts use `text-xs` (12px). Acceptable for a desktop app, but 13px (native macOS body) is slightly more comfortable for primary row text.
- **Fix:** Optional — bump primary row text to 13px in a later pass.

## Unverified (needs a different input to check)
- Keyboard focus-visible styling on custom controls (screenshot can't confirm; code shows a global `:focus-visible` ring — looks covered).
- Light-theme appearance over vibrancy (screenshot is dark theme only).

## What's working well
- Primary text (`#fafafa`, ~19:1) and `--text-secondary` (~7.5:1) pass AA comfortably.
- Restrained accent usage; clear single bright element per screen.
- Consistent spacing rhythm and a clear page-title → content hierarchy.

## Quick wins
- [x] Raise `--text-muted` to AA in both themes (finding #1).
- [x] Bump the 10px crossfade label to 11px (finding #2).
