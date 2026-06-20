# UI/UX Review: TuneVault (desktop app)

**Reviewed:** 2026-06-19 · **Input:** local code (React/Tailwind) + live screenshots of the running Electron app · **Method:** NN/g heuristic evaluation + guideline review, with measured CSS values

## Executive summary

- Solid, coherent native-desktop design. Strong text hierarchy (primary 19:1, secondary 7.8:1), clear active-nav, confirmed destructive actions, and — after recent work — real loading/progress feedback. No catastrophic, task-blocking issues.
- **Single worst problem:** keyboard focus is invisible on the player transport and the sidebar nav (zero `:focus-visible` styles on those components). A keyboard or switch user cannot see where they are.
- Two measured contrast failures against WCAG AA: the muted text token (`#76767f`, 4.42:1 on the base, 3.85:1 on hover rows) and white-on-accent primary buttons (2.8:1 on the orange accent, 3.68:1 on blue).
- Minor consistency drift: a new `<Button>` system coexists with many hand-rolled pill buttons, and destructive confirms use a filled-red style while the `Button` danger variant is outline.
- This is a mouse-first desktop app (min width 900px, no mobile target), so the touch-target findings are softened but still relevant for the smallest icon controls.

**Findings:** 🟥 0 catastrophic · 🟧 3 major · 🟨 3 minor · ⬜ 2 cosmetic

## Findings

### 🟧 Severity 3 — Major

#### 1. Player transport and sidebar nav have no visible keyboard focus
- **What:** `PlayerBar.tsx` and `Sidebar.tsx` contain **zero** `:focus-visible`/focus-ring styles (grep: 0 matches each). The core transport controls (play/pause, next, prev, shuffle, repeat, speed, volume, queue) and the primary navigation give no visible indication of keyboard focus. The shared `Button`, inputs, and `Checkbox` do have focus rings — these two high-traffic components were missed.
- **Where:** `src/renderer/src/components/player/PlayerBar.tsx`, `src/renderer/src/components/layout/Sidebar.tsx`.
- **Guideline:** Visibility of system status (Heuristic #1) + keyboard operability. A focus indicator must be perceivable.
- **Evidence:** [10 Usability Heuristics for UI Design](https://www.nngroup.com/articles/ten-usability-heuristics/) — the system should always keep users informed about what is happening, including where focus/selection currently sits; WCAG 2.4.7 Focus Visible.
- **Fix:**
  - [ ] Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base` to the sidebar nav buttons and every player control button.
  - [ ] Easiest path: migrate those controls to the shared `<Button variant="ghost">` (which already carries the ring), or add a small `.icon-btn` utility class with the ring and reuse it.

#### 2. Muted text fails WCAG AA contrast (4.5:1) wherever it sits at ≤14px
- **What:** `--text-muted: #76767f` measures **4.42:1 on `--bg-base` (#09090b), 4.25:1 on card surfaces (#0f0f12), and 3.85:1 on hovered rows (#1a1a1f)** — all below the 4.5:1 AA floor for normal text. It is used at 11–13px for real secondary info: track durations/bitrates, player timestamps ("0:30 / 4:27"), the "Supports YouTube…" hint, version label, and column-header labels. The CSS comment next to the token claims "AA (~4.5:1)" but the measured value is under the line.
- **Where:** `src/renderer/src/styles/index.css` (`--text-muted`, lines ~75 light / ~138 dark); rendered in `TrackList`, `PlayerBar` (SeekBar times), `PlaylistView` hint, `Sidebar` version.
- **Guideline:** Accessibility — minimum text contrast.
- **Evidence:** [Low-Contrast Text Is Not the Answer](https://www.nngroup.com/articles/low-contrast/) — low-contrast text is "illegible, undiscoverable, and inaccessible"; meet WCAG AA. WCAG 1.4.3 requires ≥4.5:1 for normal text.
- **Fix:**
  - [ ] Change dark `--text-muted` to `#86868f` (measured 5.51:1 base / 5.30:1 card / 4.80:1 hover — passes on all three surfaces). `#8b8b94` gives more headroom if preferred.
  - [ ] Re-measure the light-theme muted token the same way and bump it to ≥4.5:1 on `#ffffff`.
  - [ ] Fix the misleading "AA (~4.5:1)" comment so it stops vouching for a failing value.

#### 3. White text on the accent button fails AA contrast
- **What:** `.btn-accent` sets `color: var(--text-inverted)` = `#ffffff` in dark mode over the accent gradient. Measured: **2.8:1 on the default orange accent (#f97316)** and **3.68:1 on the blue accent (#3b82f6)** — both below 4.5:1 for the 13–14px button labels (e.g., "Fetch Playlist", "Save", "Download All"). These are the app's primary calls to action.
- **Where:** `src/renderer/src/styles/index.css` `.btn-accent` (~547–566); used by the shared `Button` primary variant and the fetch/download CTAs.
- **Guideline:** Accessibility — text-on-color contrast for the most important controls.
- **Evidence:** [Low-Contrast Text Is Not the Answer](https://www.nngroup.com/articles/low-contrast/) — applies to text on colored surfaces, not just gray-on-white; WCAG 1.4.3.
- **Fix:**
  - [ ] Darken the accent used *behind button text* (a one-stop-darker token, e.g. orange→`#c2410c`, blue→`#1d4ed8`) so white clears 4.5:1, or
  - [ ] keep the bright accent but use a near-black label on light accents (the orange case especially), choosing label color by accent luminance.
  - [ ] Verify the chosen pair ≥4.5:1 before shipping.

### 🟨 Severity 2 — Minor

#### 4. Smallest icon controls are ~24px with tight crowding
- **What:** Row hover-actions (folder/trash) and the delete-confirm check/x use a 16px icon with `p-1` (4px) ≈ **24px** hit area, clustered in a `gap-1` group; several secondary player controls are similar. NN/g recommends ~1cm (≈40–44px); WCAG 2.5.8 floor is 24×24px, so these sit right at the floor with little spacing. Mouse use softens this, but the row-action cluster is a crowding risk.
- **Where:** `TrackList.tsx` row action group (`p-1` icon buttons), `PlayerBar.tsx` secondary controls.
- **Guideline:** Touch/click target size and spacing.
- **Evidence:** [Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/) — minimum 1cm × 1cm; crowding causes selection errors. (Severity reduced one step: desktop pointer, not touch.)
- **Fix:**
  - [ ] Bump icon buttons to `p-1.5`–`p-2` (≈28–32px) and increase the inter-button gap to `gap-1.5`.
  - [ ] Keep ≥24px even in the compact track-density mode.

#### 5. Two destructive-button styles
- **What:** Delete/Erase confirm dialogs use a **filled** `bg-red-600` button, while the shared `Button` `danger` variant is **outline** red. Same intent, two appearances.
- **Where:** `LibraryView.tsx`/`SettingsView.tsx` confirm modals vs `Button.tsx` danger variant.
- **Guideline:** Consistency and standards (Heuristic #4) — same action should look the same.
- **Evidence:** [10 Usability Heuristics for UI Design](https://www.nngroup.com/articles/ten-usability-heuristics/) — consistency: users shouldn't wonder whether different wordings/visuals mean the same thing.
- **Fix:**
  - [ ] Add a filled "danger-solid" treatment to `Button` and route every destructive confirm through it, retiring the ad-hoc `bg-red-600` buttons.

#### 6. Two button systems coexist
- **What:** The new shared `<Button>` (with loading/focus/variants) is used in a handful of places; most toolbar pills, player controls, and row buttons remain hand-rolled with bespoke classes. Functional today, but it's why findings #1, #3, #5 exist in pockets.
- **Where:** app-wide; `Button.tsx` adopted in LibraryView toolbar + modals only.
- **Guideline:** Consistency and standards (Heuristic #4); maintainability.
- **Evidence:** [10 Usability Heuristics for UI Design](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Incrementally migrate toolbar/player/row buttons to `Button` (ghost/secondary/icon variants) so focus, contrast, and disabled/loading states are enforced in one place.

### ⬜ Severity 1 — Cosmetic

#### 7. `h1` size differs between views
- **What:** The Home hero `h1` is ~34px (`2.1rem`); every other view's `PageHeader` `h1` is 26px. Sizes still descend correctly within each view, but the top-level title isn't consistent app-wide.
- **Where:** `PlaylistView.tsx` hero vs `PageHeader.tsx`.
- **Guideline:** Visual hierarchy / consistency.
- **Evidence:** [Visual Hierarchy in UX: Definition](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) — consistent type scale signals structure.
- **Fix:**
  - [ ] Pick one hero/title scale (the Home hero is a deliberate empty-state moment, so this may be intentional — if so, leave it).

#### 8. Settings section heading is an `<h2>` styled as an 11px caps label
- **What:** `SettingsView` `Section` renders `<h2 class="text-[11px] uppercase tracking-wider text-text-muted">`. The outline order is fine (h1 26px → h2 11px), but an 11px muted-uppercase heading is small, and it inherits the failing muted color from finding #2.
- **Where:** `SettingsView.tsx` `Section`.
- **Guideline:** Typography — heading legibility.
- **Evidence:** [Legibility, Readability, and Comprehension](https://www.nngroup.com/articles/legibility-readability-comprehension/).
- **Fix:**
  - [ ] Keep the caps-label look but raise to 12px and use a token that passes contrast (resolved by fixing #2).

## Unverified (needs a different input to check)
- **Error-message quality (Heuristic #9):** toasts surface backend errors directly (`toast.error((e as Error).message)`). Some are app-authored and clear; others may pass through raw yt-dlp/ffmpeg/MusicBrainz strings, which aren't plain-language. Needs runtime triggering of each failure path to judge. Reference for the fix: [Error Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/).
- **Full hover/loading/disabled coverage:** many states verified live (Button loading, vinyl loader, Fetch-Genres/Rebuild progress, delete "Deleting…"), but not every control was exercised.
- **Light theme:** all contrast math above is for the dark theme (the active one in testing). Light-theme pairs (esp. muted text) need the same measurement.

## What's working well
- **Hierarchy & legibility of primary/secondary text:** `--text-primary` 19:1 and `--text-secondary` 7.76:1 are excellent; the type scale reads clearly.
- **Status visibility (recent work):** active-nav highlight, the spinning-vinyl loader, in-button spinners, and determinate "X of N" progress on long operations (genre fetch, rebuild) give strong feedback.
- **Error prevention for destructive actions:** confirm dialogs on deletes, a type-to-confirm forcing function on "Erase Everything", and modals that now stay open + report on failure.
- **Recognition over recall:** the genre combobox (iTunes list), recent-playlist suggestions, and the editable inspector reduce memorization.
- **Spacing & alignment:** after the padding pass, generous, consistent gutters and a centered max-width column give a calm, native layout.

## Quick wins
- [ ] Change dark `--text-muted` `#76767f` → `#86868f` (one line; clears AA on all three surfaces) and fix its comment.
- [ ] Add the `focus-visible` ring to sidebar nav buttons and player controls (or swap them to `<Button variant="ghost">`).
- [ ] Use a darker accent (or dark label) behind primary-button text so it clears 4.5:1 — most impactful on the orange default (2.8:1 today).
- [ ] Bump row/secondary icon buttons from `p-1` to `p-1.5`+ and widen their gap.
