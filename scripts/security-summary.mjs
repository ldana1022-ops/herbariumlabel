#!/usr/bin/env bun
/**
 * Collects security-reports/*.json into a markdown summary used for:
 *  - the sticky pull request comment
 *  - the GitHub Actions job summary
 *  - the commit status check conclusion (exit code / STATUS output)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_DIR } from "./lib/report.mjs";

const ICON = { pass: "✅", warn: "⚠️", fail: "❌" };
const MARKER = "<!-- lovable-security-summary -->";

const reports = existsSync(REPORT_DIR)
  ? readdirSync(REPORT_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(REPORT_DIR, f), "utf8")))
      .sort((a, b) => a.name.localeCompare(b.name))
  : [];

const failed = reports.filter((r) => r.status === "fail");
const warned = reports.filter((r) => r.status === "warn");
const overall = failed.length > 0 ? "fail" : warned.length > 0 ? "warn" : "pass";

const sha = process.env["GITHUB_SHA"]?.slice(0, 7) ?? "local";
const lines = [
  MARKER,
  `## ${ICON[overall]} Security scan summary`,
  "",
  reports.length === 0
    ? "_No scan reports were produced._"
    : `Commit \`${sha}\` — ${reports.length - failed.length - warned.length} passed, ${warned.length} warning(s), ${failed.length} failure(s).`,
  "",
];

if (reports.length > 0) {
  lines.push("| Check | Result | Details |", "| --- | --- | --- |");
  for (const r of reports) {
    lines.push(`| ${r.name} | ${ICON[r.status] ?? "❔"} ${r.status} | ${r.summary ?? ""} |`);
  }
  lines.push("");

  for (const r of reports) {
    if (r.status === "pass") continue;
    lines.push(`<details><summary>${ICON[r.status] ?? "❔"} ${r.name}</summary>`, "");
    for (const f of r.findings ?? []) lines.push(`- \`${f}\``);
    if (r.details) lines.push("", "```text", r.details, "```");
    lines.push("", "</details>", "");
  }
}

if (overall === "fail") {
  lines.push("Fix the failing checks above before merging.");
} else {
  lines.push("All security checks passed.");
}

const markdown = lines.join("\n") + "\n";
writeFileSync(join(REPORT_DIR, "summary.md"), markdown, "utf8");
console.log(markdown);

const description =
  overall === "pass"
    ? "All security checks passed"
    : `${failed.length} failing, ${warned.length} warning security check(s)`;

if (process.env["GITHUB_OUTPUT"]) {
  appendFileSync(
    process.env["GITHUB_OUTPUT"],
    `status=${overall}\nstate=${overall === "fail" ? "failure" : "success"}\ndescription=${description}\n`,
  );
}
if (process.env["GITHUB_STEP_SUMMARY"]) {
  appendFileSync(process.env["GITHUB_STEP_SUMMARY"], markdown);
}

process.exit(0);
