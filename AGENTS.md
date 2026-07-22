# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single **Node.js Claude Code plugin** (`@openai/codex-plugin-cc`) that wraps the local **Codex CLI**. There are no servers, TCP ports, or databases; inter-process communication uses local Unix sockets. See `README.md` and `package.json` scripts for the canonical commands.

### Environment notes (non-obvious)
- `node` resolves to `/exec-daemon/node`, while `npm` comes from nvm. Because of this mismatch npm's default global prefix is `/` (root-owned), so a plain `npm install -g` fails with `EACCES`. The npm global prefix is therefore set to `~/.npm-global` (via `~/.npmrc`), and `~/.npm-global/bin` is on `PATH` via `~/.bashrc`. The update script installs the required **Codex CLI** (`@openai/codex`) there.
- nvm prints a harmless warning on shell startup: `... .npmrc file ... has a globalconfig and/or a prefix setting, which are incompatible with nvm`. Ignore it — it does not affect tests, build, or `codex`.

### Commands (run from repo root)
- Test: `npm test` — 91 tests via Node's built-in runner. Runs fully offline against a fake Codex fixture (`tests/fake-codex-fixture.mjs`); no auth needed.
- Build / lint: `npm run build`. There is no separate lint step; the build is the type-check. Its `prebuild` invokes the **real `codex` binary** (`codex app-server generate-ts`), so `codex` must be on `PATH` (it is, via the update script).
- Run plugin commands directly: `node plugins/codex/scripts/codex-companion.mjs <setup|status|...>` (these map to the `/codex:*` slash commands defined in `plugins/codex/commands/`). `setup` and `status` run offline and are a good smoke test.

### Real Codex calls need auth (optional)
Running actual Codex reviews/tasks (e.g. `/codex:review`, `/codex:rescue`) requires Codex authentication (`codex login`, or an `OPENAI_API_KEY`). This is **not** required for `npm test` or `npm run build`; only for live end-to-end Codex operations.
