#!/usr/bin/env bun
/**
 * Lightweight secret scanner for CI.
 * Fails the build when a credential-shaped literal is committed in source.
 * Publishable/anon keys are allowed (they are safe by design).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src", "scripts"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".nitro", ".wrangler"]);

const RULES = [
  { name: "Supabase secret key", re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "Supabase service_role JWT", re: /"?service_role"?\s*:\s*"[A-Za-z0-9._-]{20,}"/ },
  { name: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Stripe secret key", re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Generic hardcoded secret assignment", re: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9/+_-]{24,}["']/i },
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (EXTS.has(extname(entry))) yield full;
  }
}

const findings = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/sb_publishable_|VITE_SUPABASE_PUBLISHABLE_KEY|process\.env|import\.meta\.env/.test(line)) return;
      for (const rule of RULES) {
        if (rule.re.test(line)) {
          findings.push(`${file}:${i + 1}  ${rule.name}`);
          break;
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Potential secrets committed to source:\n");
  for (const f of findings) console.error("  " + f);
  console.error("\nMove these values to server-side secrets and read them inside handlers.");
  process.exit(1);
}

console.log("Secret scan: no hardcoded credentials found.");
