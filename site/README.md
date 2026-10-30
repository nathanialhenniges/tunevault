# TuneVault docs site

The user guide at https://nathanialhenniges.github.io/tunevault/, built with
[Fumadocs](https://fumadocs.dev) and deployed to GitHub Pages by
`.github/workflows/pages.yml` on every push to `main` that touches `site/` or
the legal documents.

```bash
cd site
npm ci
npm run dev      # http://localhost:3000
npm run build    # static export into out/
```

- Guide pages live in `content/docs/*.mdx`; sidebar order is `content/docs/meta.json`.
- The Privacy Policy, Terms of Use and third-party notices are copied from
  `../docs/` at build time by `scripts/sync-legal.mjs`. Edit them there, not here.
