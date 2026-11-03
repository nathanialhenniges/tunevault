# TuneVault legal and privacy release notes

Internal implementation/review note, researched 2026-10-28. Uses the legal compliance-check and legal-risk-assessment workflows. This is drafting and issue spotting, not legal advice, an attorney-client privileged memo, or legal clearance. Qualified review is recommended for the public downloader/provider workflow and enforceability of the final terms.

## Recommended minimum

Keep the app useful: an About/Legal entry with the software license, third-party notices, Terms of Use, Privacy Policy, and a short first-online-download notice. No repeated legal modal for ordinary local-library work. These documents do not require an account, a backend, paid services, or collecting the user's identity.

“Educational purposes,” “personal use,” and “we accept no responsibility” do not make an otherwise restricted act permitted or eliminate every form of liability. The drafts use a lawful-use requirement and limited warranty/liability language with mandatory-law carveouts instead. Copyright permissions and a service's contractual restrictions are separate questions. The Copyright Office says fair use is case-specific and noncommercial/educational use is not automatically fair. [U.S. Copyright Office fair-use guidance](https://www.copyright.gov/fair-use/more-info.html)

YouTube's published terms restrict downloads except through permitted service features or written permissions, and separately restrict automated access and interference with access/copy protections. A rights holder's permission to copy music does not alone resolve YouTube's separate service terms. Do not market TuneVault as granting permission or immunity. [YouTube Terms of Service](https://www.youtube.com/static?template=terms)

Do not infer a blanket archival exemption from the age of a track. DRM/access-control questions require their own analysis; the Copyright Office maintains specific, time-limited Section 1201 exemptions. Do not build circumvention into the approved scope. [Copyright Office Section 1201 resources](https://www.copyright.gov/1201/)

## Short in-app notice

Show once before the first online acquisition, with links to Terms and Privacy and a dismissible acknowledgment. Do not precheck consent or treat acknowledgment as proof of permission.

> Download only content you own, have permission to copy, or are legally entitled to use. Follow the source service's rules. Personal or educational use does not automatically make a download permitted. TuneVault does not grant music rights or bypass DRM. Online features send requests to the relevant services.

Proposed button: `I understand`. Keep cancel available. Explain optional browser-cookie access separately at the moment it is enabled; an unrelated general acknowledgment is not consent to read browser credentials.

## Practical risk assessment

Scores are qualitative planning judgments, not measured probabilities. Severity and likelihood use 1–5; multiply for prioritization.

| Issue | Severity × likelihood | Evidence and minimum action |
| --- | --- | --- |
| Claiming all personal/educational archiving is permitted | 4 × 3 = 12, high | Remove immunity wording; carry permissions/provider restrictions in product copy; seek qualified review before broad downloader promotion |
| Promising arbitrary Spotify/Apple link import or unrestricted artwork reuse | 4 × 3 = 12, high | Keep capability/completeness states; verify actual provider authorization and permitted use; see media research |
| Publishing privacy claims the rebuilt app does not satisfy | 4 × 3 = 12, high | Inspect code and network traffic on both OS builds before making claims; remove unsupported statements |
| Bundling tools without required license/source notices | 3 × 3 = 9, medium | Audit actual binaries/build configurations; ship notices and required corresponding source arrangements |
| Sensitive URLs, cookies, or local paths in support logs | 3 × 3 = 9, medium | No automatic upload; preview and redact reports; warn GitHub issues are public; test seeded-secret redaction |
| Calling unsigned installers or cryptographic update signatures an OS trust certificate | 3 × 3 = 9, medium | Describe unsigned/unnotarized status honestly; verify update signatures but never call them Apple notarization or Windows publisher signing |

The FTC instructs app developers to substantiate functionality/privacy claims, disclose material collection/sharing clearly, and honor privacy promises. “No telemetry” does not mean no network disclosure: source services, artwork hosts, and GitHub still receive requests. [FTC app-marketing/privacy guidance](https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start)

## Release facts to verify

- [x] Nathanial confirms he personally operates/distributes TuneVault and chooses MIT for his original code. Copyright holder: Nathanial Henniges. Do not substitute MrDemonWolf, Inc. as operator.
- [x] Nathanial chooses [TuneVault GitHub Issues](https://github.com/nathanialhenniges/tunevault/issues) for contact; no public email or website contact form is required by this plan. Public issues must not request credentials or sensitive personal information.
- [ ] Restore a usable issue tracker before calling it an available contact route. Live verification on 2026-10-28 showed the repository is archived and read-only, including its Issues page; owner unarchiving is the actual outstanding gate. This research did not change archive settings. Add an effective date only when adopting the final documents. No email, jurisdiction, arbitration, age requirement, or liability cap has been invented.
- [ ] Confirm no accounts, backend, ads, analytics, crash uploads, hosted library, or cloud music synchronization in the actual build and its dependencies. Privacy draft statements are planned, not verified.
- [ ] Inspect first-run and online-action network traffic on macOS and Windows. Document direct and redirected destinations, update-check defaults, headers, cookies, and any outgoing identifiers.
- [ ] Verify local app-data, library, temp/cache, export and credential paths, retention/cleanup behavior, and what uninstall leaves behind. Do not promise secure erase.
- [ ] Verify optional cookie access is off until explicit action; persistent token storage, credential removal, provider revocation instructions, log redaction, and report preview actually work. Avoid promising that local audio never leaves the device if fingerprinting/upload features are added later.
- [ ] Remove unused provider rows/links from the published Privacy Policy. If AcoustID is later enabled, disclose fingerprint/duration transmission before use and check service eligibility. Adding telemetry, a proxy/token backend, hosted support collection, or any other new transfer requires a fresh privacy review.
- [ ] Establish a real support-data retention practice for the selected GitHub route. Keep only what is needed; do not invent a fixed deletion period. If an applicable law or a particular request requires private handling, arrange a suitable method without asking the person to publish sensitive information. This is a situational obligation, not a blanket requirement for a public email or contact form. Recheck law-specific disclosures and rights for the actual launch geography and business.
- [ ] Give Terms/Privacy/License/Third-party notices permanent local About/Legal access and documentation links. Review user-facing marketing against actual capability and evidence.
- [ ] Finalize release-specific license notices and source compliance before distributing installers. TOS language is not a replacement for component licenses.

## Open-source licensing boundary

Do not add a blanket “non-commercial only,” “no redistribution,” or reverse-engineering prohibition over rights already granted by MIT or the component licenses. Keep “personal archiving” as purpose wording. MIT is Nathanial's confirmed choice for his original code; use the exact specimen in `license-draft.md` when rebuilding, preserving any applicable existing contributor notices. MIT does not promise that every liability exclusion is enforceable everywhere.

FFmpeg licensing depends on the build: optional GPL parts change the resulting FFmpeg binary's license, and `--enable-nonfree` raises a redistribution problem. Keep the exact build configuration, notices, and required corresponding source. Running it as a separate executable does not waive the executable distributor's obligations. [FFmpeg's official legal guidance](https://ffmpeg.org/legal.html)

yt-dlp's standalone bundles include separately licensed dependencies; its README requires respecting those licenses. Audit the exact artifact used rather than assuming a source repository's Unlicense label covers its entire binary bundle. Deno/EJS and any image/tagging/database/native modules also need included notices. [yt-dlp dependency/license documentation](https://github.com/yt-dlp/yt-dlp#dependencies)

## What these drafts intentionally omit

No invented business address, automatic statutory exemption, arbitration clause, mandatory venue, indemnity demand, total liability waiver, blanket commercial-use ban, arbitrary age gate, cookie banner for a nonexistent website, consent logging backend, or claim of global privacy-law compliance. Add a clause only when the actual product/operator/jurisdiction creates a reason. Drafts remain local and unpublished.
