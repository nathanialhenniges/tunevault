# First-run and onboarding research

2026-10-30. This is research and a recommendation, not an implemented spec. **Opinion** marks design judgement.

## 1. Key principles

- **Teach by doing.** Prefer tips in context to a single flow. If someone skips the tutorial, don't show it again, but keep it findable. Present required legal text "in a balanced way". [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
- **Keep any splash brief.** macOS needs no launch screen. [HIG: Launching](https://developer.apple.com/design/human-interface-guidelines/launching)
- **Limit Liquid Glass.** Use it for controls and navigation, not content, and use the regular variant on text-heavy surfaces. [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- **Make first run do only required tasks.** Choose safe defaults and present everything else in context. Legal opt-ins "can't have default selections". [Microsoft: First Experience](https://learn.microsoft.com/en-us/windows/win32/uxguide/exper-first-exper) (a Windows 7-era guide, but still Microsoft's only first-run guidance)
- **Keep tips short, occasional and non-critical.** People read about 3-5 words before deciding whether to engage. [Microsoft: Teaching tips](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/teaching-tip)
- **Avoid deck-of-cards tutorials.** They don't improve task performance and are forgotten quickly. If you keep one, show one concept per card with a visible Skip. [NN/g](https://www.nngroup.com/articles/mobile-app-onboarding/), [NN/g](https://www.nngroup.com/articles/onboarding-tutorials/)
- **Use empty states to teach.** Say what will appear and give a direct action. [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)
- **Follow dialog accessibility rules:**
  - Focus a start element, trap Tab, and let Escape close [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
  - Announce changes without moving focus [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
  - Let people turn off motion caused by interaction [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

**Real apps.** These are from docs or secondary sources. I tested none of them.

| App | First run |
| --- | --- |
| MusicBee | Asks which folders to scan and offers an iTunes import ([wiki](https://musicbee.fandom.com/wiki/Importing)). |
| Swinsian | A welcome window with an Import button ([FAQ](https://swinsian.com/support/faq/)). |
| Doppler | "Import from Music" or add files ([9to5Mac](https://9to5mac.com/2022/09/01/doppler-hifi-music-player-mac-import-library/)). |
| foobar2000 | Quick Appearance Setup, which can be reopened (third-party guides). |
| Things | A real "Meet Things" project, which can be recreated from Help ([Cultured Code](https://culturedcode.com/things/support/articles/2803553/)). |
| Raycast | Set your hotkey, then try a command (third-party). |
| Linear | Theme choice, then press Cmd/Ctrl+K yourself (teardowns that disagree on order). |

Plexamp (sign in, pick a server) is from old guides. Spotify, Notion, Arc, 1Password and Apple Music are from memory only, so check them on Mobbin.

The common pattern in library apps: **start with where your music comes from, not with a feature tour.**

## 2. Critique

**Splash** (`Welcome.tsx:7-20`): good as it is.
- The 180 ms delayed fade (`styles.css:1728`) means a fast load never shows it.
- Reduced motion is honored (`styles.css:1871-1876`).

**Disclaimer** (`Welcome.tsx:22-105`): correctly mandatory.
- What works: the checkbox starts unchecked, focus goes to the heading (`:27`), and Quit is offered.
- Issues:
  - Four dense bullets (`:40-58`) read as a warning before the reader knows what the app does.
  - The privacy point (`:55-56`) is actually reassurance, but it is buried among the warnings.

**Guide** (`Welcome.tsx:107-237`):
- **Six text cards with a generic icon** (`:107-138`, `:172-174`). This is the deck-of-cards pattern. It shows neither the real logo (`App.tsx:11-12`) nor any real UI.
- **Only one card does anything** (`:180-196`).
  - Next stays enabled even when no vault is chosen.
  - So "Add music…" (`:213-219`) opens an import that is disabled without a vault (`AddDialog.tsx:77`).
  - Dropping files fails too (`App.tsx:300-304`).
- **The Playlists and Devices cards teach features the user can't try yet.** The existing empty states already do that job better (`Playlists.tsx:79-88`, `Devices.tsx:74-85`).
- **The Library empty state has no action** (`Library.tsx:129-133`).
- **Terminology drifts:** "vault" (`Welcome.tsx:115`) vs "archive location" (`AddDialog.tsx:185`).
- **Focus bugs:**
  - On the last step, Next unmounts (`Welcome.tsx:211-233`), so focus falls to `<body>`.
  - Step changes aren't announced: the counter isn't a live region (`:175-177`) and the dots are hidden (`:197`).
- **Two gates back-to-back.** The guide opens over an empty app straight after the disclaimer (`App.tsx:875`).
- **Hard to reopen.** It's only reachable from Settings (`Settings.tsx:407`), not from the Help menu (`src/main/index.ts:734-744`).

## 3. Recommended design

**Opinion:** replace the tour with three layers.

**A. One first-launch window with two panes**

1. **Welcome**
   - The real wolf logo at 96 px, in the current accent.
   - Copy: "Keep your own music organized, tagged and ready for your iPod or MP3 player."
   - Three icon rows using the existing `Icon` set:
     - "Stays on this computer: no account, no analytics."
     - "Your original files are never changed."
     - "Every edit can be undone."
   - Button: **Continue**.
2. **Use it for music you own** (mandatory)
   - Copy: "Only add music you own or are licensed to keep. You're responsible for what you copy. TuneVault is free, open source and comes with no warranty. It isn't affiliated with Apple, Spotify, YouTube, Google, SoundCloud or iMazing."
   - Links to Terms and Privacy.
   - Keep the unchecked checkbox.
   - Buttons: **Quit** / **Agree and continue**.

**B. Setup sheet: "Set up your library"**

Two numbered tasks that get check marks. They serve as the progress indicator, so no dots.

1. **"Choose where TuneVault keeps your music."**
   - Suggest `Music/TuneVault` and show its free space.
   - Buttons: **Use this folder** / **Choose another…**.
2. **"Bring in your music."**
   - Enabled only after step 1.
   - Show a drop zone plus the real routes: Choose files…, Choose folder…, Import playlist file (CSV/TSV, M3U, Spotify JSON, Apple XML).
   - A **Later** link.
   - Progress then continues in Activity.

**C. Learn in context**

- **Library empty state:** add **Add music…** and "or drop files anywhere". Keep the other empty states as they are.
- **At most three one-time tips:** popovers with an arrow, under 15 words, one per session:
  - After the first import: "Select tracks to edit tags in Details."
  - After the first playlist: "Drag rows to reorder."
  - After the first target: "Prepare export lists every copy and conversion first."
- **Opinion:** no persistent checklist. Setup covers the only required tasks, and a checklist would duplicate the empty states.

**Reappearance**
- The disclaimer returns only when its version changes. Store `disclaimerVersion`.
- The setup sheet returns while no vault exists.
- Tips never repeat.
- Add **Help > Welcome to TuneVault** and **Help > Reset tips**.

**Native feel**
- macOS:
  - Use a sheet-style panel with a standard material.
  - Glass, if used at all, goes only on the button bar.
  - Primary button on the right.
- Windows 11:
  - Use the Fluent dialog layout and a solid surface.
  - Use sentence-case labels, as the app already does.
- Any preview images must be real crops of the app, not invented illustrations.

**Accessibility**
- Focus the heading of each new pane. Mirror the step in a `role="status"` region, for example "Step 2 of 2: Bring in your music".
- Keep Tab inside the window.
- Escape means Later on the setup sheet and does nothing on the disclaimer.
- Drop pane transitions under Reduce Motion, and use opaque fallbacks under Reduce Transparency.
- Tips must open from the keyboard, dismiss with Escape, and never take focus.

## 4. For Mobbin follow-up

Filter by desktop/macOS and web. For each, record the screen order, button labels and placement, progress indicator, skip/back behavior and how to reopen the flow.

- **Apple Music, "onboarding" and "empty state":** welcome copy and what an empty library shows.
- **Spotify, "empty state" and "Your Library":** CTA wording and the balance between illustration and text.
- **Linear, "onboarding":** the theme step and the interactive Cmd+K step, and how keys are drawn.
- **Raycast, "onboarding" and "permissions":** the hotkey recorder and permission screens.
- **Arc, "onboarding" and "import":** the import-from-another-app screen. This is the model for "Bring in your music".
- **Notion, "setup checklist" and "getting started":** confirm the seeded checklist page and how it is dismissed.
- **Things, "onboarding":** the tutorial-as-content pattern.
- **1Password, "onboarding" and "permissions":** trust copy and consent layout, as a reference for the disclaimer pane.
- **Generic desktop searches:** "terms acceptance" for consent that doesn't feel alarming, "choose location" for default path and free space, and "coach mark" for tip size, arrow and dismiss controls.

## 5. Implementation checklist

- [ ] `src/renderer/src/Welcome.tsx`:
  - Combine Welcome and Disclaimer into two panes.
  - Replace the `steps` deck with a two-task `Setup` sheet.
  - Focus the heading on each pane and add a live status region.
  - Fix the focus loss when Next unmounts.
- [ ] `src/shared/types.ts` plus the main-process settings store:
  - Add `disclaimerVersion` and `tipsSeen: string[]`.
  - Migrate the existing `disclaimerAccepted` and `onboarded` values.
- [ ] Main-process `chooseVault`: return a suggested default and its free space.
- [ ] `src/renderer/src/App.tsx`:
  - Gate setup on `!settings.vault`.
  - Host tips.
  - Handle the `welcome` and `resetTips` menu actions.
- [ ] `src/main/index.ts`: add both Help menu items.
- [ ] `src/renderer/src/ui.tsx`: add a `Tip` popover (Escape to dismiss, `aria-describedby` on its target).
- [ ] `src/renderer/src/Library.tsx`: add the empty-state action and align the copy.
- [ ] `src/renderer/src/AddDialog.tsx`: say "vault" and reuse the shared vault picker.
- [ ] `src/renderer/src/Settings.tsx`: add a "Reset tips" button.
- [ ] `src/renderer/src/styles.css`: replace the `.onboarding*` and `.first-run*` styles, with reduced-motion and reduced-transparency fallbacks.
- [ ] Tests (Vitest and Playwright), coordinating with the existing `tests/e2e/onboarding.spec.ts`:
  - The disclaimer blocks the app.
  - Setup requires a vault.
  - Focus is never lost.
  - The flow reopens from Help.
- [ ] Manual checks with VoiceOver and NVDA on packaged builds.

## 6. Mobbin verification and implementation record

The references below were searched through Mobbin and their actual captured screens were inspected. These are static reference captures, not hands-on tests of those products. Desktop web references inform individual patterns; mobile captures do not establish native desktop behavior.

| Reference | Verified observation | TuneVault use |
| --- | --- | --- |
| [Apple Music empty library](https://mobbin.com/screens/bdc69b59-1062-43ee-91da-589de56512b6) | Centered explanation with an immediate action. | Library empty state has a primary Add music action. |
| [Spotify library](https://mobbin.com/screens/546316d5-f68c-4bb6-bcda-b578d70ff27c) | Empty sidebar region offers Create playlist. | Actions belong beside the empty content they populate. |
| [Linear onboarding](https://mobbin.com/flows/cbaf58a9-fd84-4afe-b214-e65b24484013) | Theme choice precedes the command-menu lesson; an integration can be skipped. | Confirms the earlier order claim. The slide deck and progress dots were not adopted. |
| [Notion getting started](https://mobbin.com/screens/7d92c438-ee81-4dda-8eaf-f7ee1ffb4ed3) | A seeded checklist contains actual tasks. | Setup performs folder selection and import review. Dismiss/reopen behavior was not established by the capture. |
| [Pitch consent](https://mobbin.com/screens/dd959e3a-b372-4243-8ca9-e4fc7448f6d2) | One quiet consent decision, linked policies, unchecked agreement. | Required consent remains blocking and unchecked. |
| [1Password setup](https://mobbin.com/screens/e4415dfe-b92a-49b2-b46a-5da821d1543a) | Extension setup has a clear primary action and secondary skip. | Optional setup can be deferred. This does not verify OS permission behavior. |
| [Folder selection](https://mobbin.com/screens/f435eeed-debe-4679-a5f2-8a6adafd1951) | Location breadcrumb and explicit Select Folder action. | Use native selection; suggested Music location and capacity are TuneVault decisions, not claims about this reference. |
| [Turo contextual tip](https://mobbin.com/screens/62603fb6-45ed-478d-99ea-663c1e41a97b) | Tip points at an actual control and offers dismissal. | Small contextual tips attach to real controls; no full-screen lesson. |
| [Things for iPhone](https://mobbin.com/flows/37eb30d1-caa8-4795-ae8b-0ea1a7e790eb) | Tutorial is actual project content; copy mentions recreation from Settings. | Supports tutorial-as-content only. No macOS Help behavior was verified. |
| [Raycast mobile](https://mobbin.com/flows/f929cc50-8d22-4dbe-974d-367c672ac7e3) | Account welcome and command list. | Not used as evidence for a macOS hotkey recorder or permissions flow. Desktop searches returned unrelated products. |
| [Arc Search mobile](https://mobbin.com/flows/4260d248-66f7-4b8a-952e-81446a19bbd6) | Real keyboard trial and optional skip. | Desktop browser import remains unverified; web results for Arcade were rejected as a different product. |

Apple Music web onboarding was also inspected, but its account/payment flow and preselected marketing checkbox were rejected as unsuitable. Generic coach-mark searches returned several unrelated coaching products; those were not treated as UI evidence. Reference images and product styling were not copied into the application.

Implemented scope: real accent-aware logo; welcome then mandatory authorized-use consent; two-task setup with a usable-library-folder gate; native file/folder selection and playlist-file review; actionable empty Library; persistent one-time tips; Help > Welcome Guide and Settings reopen; heading focus, step status announcements, focus return and reduced-motion styles. The native `defaultFolder` action supplies the suggested location and free-space information without creating anything until Use this folder is chosen.

Implementation differs from the preliminary checklist: contextual help lives in `Welcome.tsx` with scoped `welcome.css`, rather than adding another shared UI abstraction. Reset-tips controls were deferred to the coordinated Settings owner. VoiceOver/NVDA checks remain unrun; automated focus checks are not screen-reader proof.
