#!/usr/bin/env bun
/**
 * Generates a CycloneDX 1.5 SBOM from bun.lock (plus installed package metadata
 * when node_modules is present). Output: security-reports/sbom.cdx.json
 * CI uploads it as a build artifact for every PR.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_DIR, writeReport } from "./lib/report.mjs";

const LOCK = "bun.lock";
const OUT = join(REPORT_DIR, "sbom.cdx.json");

if (!existsSync(LOCK)) {
  console.error(`${LOCK} not found. Run \`bun install --save-text-lockfile\` first.`);
  process.exit(1);
}

/** bun.lock is JSON with trailing commas allowed. */
function parseLock(text) {
  return JSON.parse(text.replace(/,(\s*[}\]])/g, "$1"));
}

const lock = parseLock(readFileSync(LOCK, "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const directDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

/** Split "@scope/name@version" into [name, version]. */
function splitDescriptor(descriptor) {
  const at = descriptor.lastIndexOf("@");
  if (at <= 0) return [descriptor, "unknown"];
  return [descriptor.slice(0, at), descriptor.slice(at + 1)];
}

function installedMeta(name) {
  const file = join("node_modules", name, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function licenseEntries(license) {
  if (!license) return undefined;
  if (typeof license === "string") {
    return /\bOR\b|\bAND\b|\(/.test(license)
      ? [{ expression: license }]
      : [{ license: { id: license } }];
  }
  if (typeof license === "object" && license.type) return [{ license: { id: license.type } }];
  return undefined;
}

const components = [];
const seen = new Set();

for (const [key, entry] of Object.entries(lock.packages ?? {})) {
  if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;

  const [name, rawVersion] = splitDescriptor(entry[0]);
  const remote = /^https?:|^git\+|^file:/.test(rawVersion);
  const meta = installedMeta(key) ?? installedMeta(name);
  const version = remote ? (meta?.version ?? rawVersion) : rawVersion;

  const id = `${name}@${version}`;
  if (seen.has(id)) continue;
  seen.add(id);

  const integrity = entry.find((v, i) => i > 0 && typeof v === "string" && v.startsWith("sha512-"));
  const purl = `pkg:npm/${name.replace("@", "%40")}@${version}`;

  const component = {
    type: "library",
    "bom-ref": purl,
    name,
    version,
    purl,
    scope: "required",
    properties: [
      { name: "lovable:dependency-type", value: directDeps.has(name) ? "direct" : "transitive" },
      ...(remote ? [{ name: "lovable:resolved", value: rawVersion }] : []),
    ],
  };

  const licenses = licenseEntries(meta?.license ?? meta?.licenses?.[0]?.type);
  if (licenses) component.licenses = licenses;
  if (meta?.description) component.description = String(meta.description).slice(0, 300);
  if (integrity) {
    component.hashes = [
      { alg: "SHA-512", content: Buffer.from(integrity.slice(7), "base64").toString("hex") },
    ];
  }

  components.push(component);
}

components.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: "lovable", name: "sbom.mjs", version: "1.0.0" }],
    component: {
      type: "application",
      "bom-ref": `pkg:npm/${pkg.name}@${pkg.version ?? "0.0.0"}`,
      name: pkg.name ?? "app",
      version: pkg.version ?? "0.0.0",
    },
    properties: [
      { name: "lovable:git-sha", value: process.env["GITHUB_SHA"] ?? "local" },
      { name: "lovable:git-ref", value: process.env["GITHUB_REF"] ?? "local" },
    ],
  },
  components,
};

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(sbom, null, 2) + "\n", "utf8");

const direct = components.filter((c) =>
  c.properties?.some((p) => p.name === "lovable:dependency-type" && p.value === "direct"),
).length;
const summary = `${components.length} components (${direct} direct, ${components.length - direct} transitive) — CycloneDX 1.5.`;

console.log(`SBOM written to ${OUT}`);
console.log(summary);

writeReport("sbom", {
  name: "SBOM generation",
  status: "pass",
  summary,
  details: `Artifact: ${OUT}`,
});
