#!/usr/bin/env bun
/**
 * Dependency vulnerability gate for CI.
 * Primary: `bun audit`. Fallback: `npm audit` against a generated package-lock.
 * Exits non-zero when any high or critical advisory is present.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const LEVELS = ["high", "critical"];

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8" });
}

function countFromNpmJson(json) {
  try {
    const data = JSON.parse(json);
    const meta = data.metadata?.vulnerabilities ?? {};
    return LEVELS.reduce((sum, lvl) => sum + (meta[lvl] ?? 0), 0);
  } catch {
    return null;
  }
}

let result = run("bun", ["audit", "--audit-level=high"]);
let output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

const bunUnavailable =
  result.error != null || /audit request failed|not supported|unknown command/i.test(output);

if (!bunUnavailable) {
  console.log(output.trim() || "bun audit: no high or critical vulnerabilities.");
  process.exit(result.status ?? 0);
}

console.warn("bun audit unavailable, falling back to npm audit.\n");

const generatedLock = !existsSync("package-lock.json");
if (generatedLock) {
  const gen = run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
  if (gen.status !== 0) {
    console.error(`${gen.stdout ?? ""}${gen.stderr ?? ""}`);
    console.error("Could not create a lockfile for auditing.");
    process.exit(1);
  }
}

const npmAudit = run("npm", ["audit", "--json", "--audit-level=high"]);
const count = countFromNpmJson(npmAudit.stdout ?? "");

if (generatedLock) rmSync("package-lock.json", { force: true });

if (count == null) {
  console.error(`${npmAudit.stdout ?? ""}${npmAudit.stderr ?? ""}`);
  console.error("Audit output could not be parsed.");
  process.exit(1);
}

if (count > 0) {
  const readable = run("npm", ["audit", "--audit-level=high"]);
  console.error(`${readable.stdout ?? ""}${readable.stderr ?? ""}`);
  console.error(`Found ${count} high/critical vulnerabilities. Update the offending packages.`);
  process.exit(1);
}

console.log("npm audit: no high or critical vulnerabilities.");
