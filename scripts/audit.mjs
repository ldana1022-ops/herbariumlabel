#!/usr/bin/env bun
/**
 * Dependency vulnerability gate for CI.
 * Primary: `bun audit`. Fallback: `npm audit` against a generated package-lock.
 * Exits non-zero when any high or critical advisory is present.
 * Also writes security-reports/dependency-audit.json for the PR summary.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { writeReport, truncate } from "./lib/report.mjs";

const LEVELS = ["high", "critical"];
const CHECK = "dependency-audit";
const NAME = "Dependency audit (high/critical)";

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8" });
}

function report(status, summary, details) {
  writeReport(CHECK, { name: NAME, status, summary, details: truncate(details ?? "") });
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
  const status = (result.status ?? 0) === 0 ? "pass" : "fail";
  console.log(output.trim() || "bun audit: no high or critical vulnerabilities.");
  report(
    status,
    status === "pass"
      ? "No high or critical advisories in the dependency tree."
      : "High or critical advisories found — update the offending packages.",
    output,
  );
  process.exit(result.status ?? 0);
}

console.warn("bun audit unavailable, falling back to npm audit.\n");

const generatedLock = !existsSync("package-lock.json");
if (generatedLock) {
  const gen = run("npm", [
    "install",
    "--package-lock-only",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ]);
  if (gen.status !== 0) {
    const out = `${gen.stdout ?? ""}${gen.stderr ?? ""}`;
    console.error(out);
    console.error("Could not create a lockfile for auditing.");
    report("fail", "Audit could not run: lockfile generation failed.", out);
    process.exit(1);
  }
}

const npmAudit = run("npm", ["audit", "--json", "--audit-level=high"]);
const count = countFromNpmJson(npmAudit.stdout ?? "");

if (generatedLock) rmSync("package-lock.json", { force: true });

if (count == null) {
  const out = `${npmAudit.stdout ?? ""}${npmAudit.stderr ?? ""}`;
  console.error(out);
  console.error("Audit output could not be parsed.");
  report("fail", "Audit could not run: output was not parseable.", out);
  process.exit(1);
}

if (count > 0) {
  const readable = run("npm", ["audit", "--audit-level=high"]);
  const out = `${readable.stdout ?? ""}${readable.stderr ?? ""}`;
  console.error(out);
  console.error(`Found ${count} high/critical vulnerabilities. Update the offending packages.`);
  report("fail", `${count} high/critical advisories found — update the offending packages.`, out);
  process.exit(1);
}

console.log("npm audit: no high or critical vulnerabilities.");
report("pass", "No high or critical advisories in the dependency tree.", "npm audit: clean");
