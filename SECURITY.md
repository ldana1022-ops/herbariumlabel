# Security

## Automated scanning

CI (`.github/workflows/security.yml`) runs on every push, every pull request, weekly
(Mondays 04:00 UTC), and on manual dispatch:

| Job | What it does | Blocks deploy on |
| --- | --- | --- |
| Dependency audit | `bun run audit` — `bun audit`, falling back to `npm audit` | any high/critical advisory |
| Dependency audit | `bun run security:secrets` — source scan for credential-shaped literals | any match |
| Build | `bun run lint` + `bun run build` | lint error or build failure |
| CodeQL analysis | GitHub CodeQL for JavaScript/TypeScript | results appear in the Security tab |

The weekly schedule matters: advisories are published after code is written, so a
repo with no commits can still become vulnerable.

## Running locally

```bash
bun run audit             # high/critical dependency vulnerabilities
bun run security:secrets  # hardcoded credentials in src/ and scripts/
```

## Fixing a dependency finding

1. Upgrade the package in `package.json` (or pin the patched transitive version
   through `overrides`/`resolutions`).
2. Regenerate the text lockfile: `bun install --save-text-lockfile`.
3. Re-run `bun run audit` and `bun run build`.

## Secret handling

- Server-only values are read from `process.env` **inside** handlers, never at module scope.
- Only publishable/anon keys may appear in client code.
- Service-role keys and database passwords are never committed, logged, or returned to the client.
