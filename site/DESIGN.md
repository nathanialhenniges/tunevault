# Website redesign

Scope: the public landing page and its shared navigation. The desktop app,
download resolver, release gates and documentation routes remain unchanged.
The owner asked for Mobbin references and a closer relationship to WolfWave's
website, then specifically requested more real application screenshots.

## Direction

Use WolfWave's split copy/product hero, compact navigation, three-column
benefits, alternating workflow sections, native disclosure FAQs and closing
download action. Keep TuneVault's logo, semantic blue accent, neutral surfaces
and system font stack. No new dependencies, invented player controls, gradients,
testimonials, usage counts, signing claims or external-app integrations.

The visitor's job is to understand the library/export workflow, choose an
appropriate build, and find the unsigned-install guidance before installing.

## References inspected

These Mobbin images were opened and inspected, not inferred from their labels.
Cross-domain examples inform layout only; no copy, branding or artwork is reused.

| Change                                     | References                                                                                                                                                             | What carries over                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Split hero with a real product screenshot  | [ClickUp](https://mobbin.com/sites/sections/bfe2a759-6322-49ef-bb82-c3c344d7ed87), [ToDesktop](https://mobbin.com/sites/sections/21611e0a-3a8f-4014-a0d7-fed0488bd480) | Copy/actions and visible product beside one another; no gradient button or promotional claims   |
| Platform information beside downloads      | [Airtable](https://mobbin.com/sites/sections/ac0c0032-0b01-4bed-9f1b-c383a7bc2d3e), [Notion](https://mobbin.com/sites/sections/c9edf656-7e70-489e-9e19-82d6c3ea56bd)   | Explicit OS/architecture choices and nearby requirements; no unsupported platforms              |
| Feature descriptions with product evidence | [Pitch](https://mobbin.com/sites/sections/5103c8d1-47e3-4909-ba07-b0eeab0c24b8), [ToDesktop](https://mobbin.com/sites/sections/90fefda0-8306-46f4-875c-6a8a37fed96f)   | Short workflow descriptions and actual UI; no simulated update or notification controls         |
| Questions before installation              | [HubSpot](https://mobbin.com/sites/sections/cdc68689-5d02-404d-96e3-4a098d4d8393), [Square](https://mobbin.com/sites/sections/89c2cb81-bf4b-42ca-83d9-1d46d27ee7cd)    | Disclosure rows with readable answers; single-column placement follows WolfWave/source judgment |

Other inspected directions: Spline's centered desktop hero and Vizcom's compact
platform actions. The initial centered draft was replaced after the owner's
WolfWave clarification. Notion's current desktop website and Raycast's public
page were also read. Swinsian's page could not be fetched by the research tool;
no design claim relies on it.

The `mrdemonwolf/wolfwave` checkout was inspected read-only:
`apps/docs/app/(home)/page.tsx`,
`apps/docs/app/global.css` and `apps/docs/lib/layout.shared.tsx`. Its live Safari
capture was blank, so the comparison uses checked-out structure rather than a
claimed successful live visual check. No WolfWave files or assets were changed.

## Preserve

- Existing dynamic, complete-pair download lookup, GitHub sign-in and expiry.
- Apple Silicon M1+ on macOS 15+, Windows 10/11 x64; no Intel Mac option.
- Unsigned personal-project and fun/educational-use explanation; MIT app rights.
- Library, metadata, playlist-reference and per-target export facts and routes.
- Separate preparation, external transfer and physical playback evidence.
- Documentation/search, legal links, light/dark/System appearance and keyboard focus.

## Application screenshots

The six PNGs in `public/screenshots` are direct captures of TuneVault 4.0.0, not
redrawn interfaces. An isolated temporary profile imported eight locally
generated FFmpeg sine-wave MP3s with fictional metadata and six supplied covers.
The original cover PNGs and generation manifest remain unchanged under
`src/renderer/src/assets/demo-covers`. No personal music, provider download,
real-device write or transfer confirmation was used. Temporary audio/profile
files were removed after capture; the site ships screenshots only.

Library and Devices captures show the full app viewport; Metadata captures the
actual Inspector region. Light and dark PNGs follow the site's appearance.
Visible captions explain the synthetic fixture. `public/screenshots/provenance.json`
records file hashes, dimensions and original artwork provenance.

## Checks

Site lint, TypeScript and static export are required. Download selection retains
its existing unit tests. Render checks cover desktop and phone widths, light
and dark themes, navigation, installation links and keyboard-operable disclosures.
These website checks do not establish physical-player compatibility or OS signing.
