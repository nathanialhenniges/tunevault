# TuneVault — Claude Code

Read and follow [AGENTS.md](AGENTS.md) for the shared project rules, then the relevant source and documentation before changing behavior. This file intentionally accompanies AGENTS.md so Claude Code and Codex can work in the same repository.

## Working together

- Check `git status` first. Multiple agents may be editing this checkout; preserve their work.
- Agree on file ownership before parallel edits. Communicate API/schema changes to callers.
- Keep this file focused on Claude-specific entry instructions; shared rules belong in AGENTS.md.
- Review requests are read-only unless implementation is explicitly assigned.
- Use appropriate installed skills when useful, and verify results rather than assuming success.

## Commands

Use the exact scripts in package.json and the committed npm lockfile. Start with `npm ci`, `npm run typecheck`, and `npm test`; packaged application checks use `npm run test:e2e` after packaging. See the README and release documentation for platform gates.

Never restore the intentionally deleted historical application, reset this checkout, or create a worktree containing the old app. Do not publish releases, push tags, or change repository settings without owner authorization.
