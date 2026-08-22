/**
 * Shared helper: security scanners write a JSON report per check into
 * security-reports/ so CI can turn them into a PR comment and status checks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const REPORT_DIR = "security-reports";

/**
 * @param {string} id            stable slug, e.g. "dependency-audit"
 * @param {object} report
 * @param {string} report.name   human readable check name
 * @param {"pass"|"fail"|"warn"} report.status
 * @param {string} report.summary one-line result
 * @param {string[]} [report.findings] individual findings (rendered as a list)
 * @param {string} [report.details] fenced block of raw tool output
 */
export function writeReport(id, report) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    join(REPORT_DIR, `${id}.json`),
    JSON.stringify({ id, ...report }, null, 2) + "\n",
    "utf8",
  );
}

export function truncate(text, max = 4000) {
  const clean = (text ?? "").trim();
  return clean.length > max ? clean.slice(0, max) + "\n… output truncated …" : clean;
}
