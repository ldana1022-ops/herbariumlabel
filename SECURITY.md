# Security

## Automated scanning

CI (`.github/workflows/security.yml`) runs on every push, every pull request, weekly
(Mondays 04:00 UTC), and on manual dispatch:

| Job | What it does | Blocks deploy on |
| --- | --- | --- |
| Dependency audit | `bun run audit` — `bun audit`, falling back to `npm audit` | any high/critical advisory |
| Dependency audit | `bun run security:secrets` — source scan for credential-shaped literals | any match |
| Build | `bun run lint` + `bun run build` | lint error or build failure |
| SBOM | `bun run sbom` — CycloneDX 1.5 SBOM from `bun.lock` | never (informational) |
| CodeQL analysis | GitHub CodeQL for JavaScript/TypeScript | results appear in the Security tab |

The weekly schedule matters: advisories are published after code is written, so a
repo with no commits can still become vulnerable.

## Pull request reporting

Each scanner writes a JSON report into `security-reports/` (git-ignored).
`bun run security:summary` merges them into markdown, and CI then:

- posts/updates a single sticky comment on the pull request (marker
  `<!-- lovable-security-summary -->`, so re-runs edit the same comment instead of
  spamming new ones),
- publishes a `security/scan-summary` commit status check (success/failure) linking
  to the workflow run,
- writes the same table to the Actions job summary and uploads the raw reports as
  the `security-reports` artifact.

Scan steps use `continue-on-error` so every check reports its result; the job then
fails if any check failed. Make `security/scan-summary` a required status check in
branch protection to block merges on security failures.

## SBOM

`bun run sbom` writes `security-reports/sbom.cdx.json` — a CycloneDX 1.5 inventory of
every locked package (name, version, purl, license, SHA-512 integrity hash, and
direct-vs-transitive marker). CI regenerates it on every push/PR and uploads it as the
`sbom-<pr-number-or-sha>` artifact (90-day retention); the component count also shows up
in the PR summary comment. The file works with CycloneDX tooling such as Dependency-Track
and `grype sbom:sbom.cdx.json`.

## Running locally

```bash
bun run audit             # high/critical dependency vulnerabilities
bun run security:secrets  # hardcoded credentials in src/ and scripts/
bun run sbom              # CycloneDX SBOM -> security-reports/sbom.cdx.json
bun run security:summary  # render the combined markdown summary
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
