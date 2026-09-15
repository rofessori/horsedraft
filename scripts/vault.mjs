#!/usr/bin/env node
/**
 * HorseDraft vault.
 *
 * The maintainer notes (CLAUDE.md, AGENTS.md, .claude/agents, .claude/skills, docs/ai) are kept
 * in this public repository only as ciphertext under ai/vault/. The plaintext copies are
 * git-ignored and exist only on machines that hold the key.
 *
 *   node scripts/vault.mjs unlock [--force] [--quiet]   decrypt vault -> plaintext files
 *   node scripts/vault.mjs lock   [--prune]             encrypt plaintext files -> vault
 *   node scripts/vault.mjs status                       what differs
 *   node scripts/vault.mjs selftest                     in-memory round trip, no key needed
 *
 * Key: the HORSEDRAFT_AI_KEY environment variable, or the git-ignored file `.aikey` in the repo root.
 * Crypto: scrypt (N=2^15) -> AES-256-GCM, fresh salt + nonce per file. Vault file names are an
 * HMAC of the plaintext path so even the document names stay private.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAULT_DIR = path.join(ROOT, "ai", "vault");
const KEY_FILE = path.join(ROOT, ".aikey");
const KEY_ENV = "HORSEDRAFT_AI_KEY";
const MAGIC = "HDV1";
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

/** Plaintext locations (relative to the repo root). Directories are walked recursively. */
const TRACKED = ["CLAUDE.md", "AGENTS.md", ".claude/agents", ".claude/skills", "docs/ai"];

// ---------------------------------------------------------------- crypto

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, SCRYPT);
}

export function encrypt(passphrase, relPath, content) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.from(JSON.stringify({ path: relPath, data: content.toString("base64") }), "utf8");
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([salt, iv, tag, body]).toString("base64");
  const wrapped = blob.match(/.{1,76}/g)?.join("\n") ?? "";
  return `${MAGIC}\n${wrapped}\n`;
}

export function decrypt(passphrase, text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== MAGIC) throw new Error("not a vault file");
  const blob = Buffer.from(lines.slice(1).join(""), "base64");
  const salt = blob.subarray(0, 16);
  const iv = blob.subarray(16, 28);
  const tag = blob.subarray(28, 44);
  const body = blob.subarray(44);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let payload;
  try {
    payload = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error("wrong key or corrupted vault file");
  }
  const doc = JSON.parse(payload.toString("utf8"));
  return { path: doc.path, content: Buffer.from(doc.data, "base64") };
}

export function vaultFileName(passphrase, relPath) {
  return createHmac("sha256", passphrase).update(relPath).digest("hex").slice(0, 32) + ".enc";
}

// ---------------------------------------------------------------- files

function readKey() {
  const fromEnv = process.env[KEY_ENV];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  if (existsSync(KEY_FILE)) {
    const k = readFileSync(KEY_FILE, "utf8").trim();
    if (k) return k;
  }
  return null;
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
}

/** All plaintext files that currently exist, as repo-relative posix paths. */
function plaintextFiles() {
  const out = [];
  for (const rel of TRACKED) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out.map((f) => path.relative(ROOT, f).split(path.sep).join("/")).sort();
}

function vaultFiles() {
  if (!existsSync(VAULT_DIR)) return [];
  return readdirSync(VAULT_DIR)
    .filter((f) => f.endsWith(".enc"))
    .map((f) => path.join(VAULT_DIR, f));
}

function readVault(passphrase) {
  const entries = new Map();
  for (const file of vaultFiles()) {
    const { path: rel, content } = decrypt(passphrase, readFileSync(file, "utf8"));
    entries.set(rel, { file, content });
  }
  return entries;
}

// ---------------------------------------------------------------- commands

function lock({ prune }) {
  const key = requireKey();
  mkdirSync(VAULT_DIR, { recursive: true });
  const existing = readVault(key);
  const present = plaintextFiles();
  let written = 0;
  let unchanged = 0;
  for (const rel of present) {
    const content = readFileSync(path.join(ROOT, rel));
    const prior = existing.get(rel);
    if (prior && prior.content.equals(content)) {
      unchanged++;
      continue;
    }
    writeFileSync(path.join(VAULT_DIR, vaultFileName(key, rel)), encrypt(key, rel, content));
    written++;
  }
  let pruned = 0;
  for (const [rel, entry] of existing) {
    if (present.includes(rel)) continue;
    if (prune) {
      rmSync(entry.file);
      pruned++;
    } else {
      console.log(`  kept in vault (no local copy): ${rel}  (use --prune to drop)`);
    }
  }
  console.log(`vault: ${written} written, ${unchanged} unchanged, ${pruned} pruned`);
}

function unlock({ force, quiet }) {
  const key = readKey();
  if (!key) {
    if (!quiet) console.log(`vault: locked. Put the key in ${KEY_ENV} or ${path.relative(ROOT, KEY_FILE)} to unlock.`);
    else console.log("HorseDraft maintainer notes are locked (no key present); the public README still applies.");
    return;
  }
  const entries = readVault(key);
  let written = 0;
  let same = 0;
  const conflicts = [];
  const created = [];
  for (const [rel, { content }] of entries) {
    const full = path.join(ROOT, rel);
    if (existsSync(full)) {
      const local = readFileSync(full);
      if (local.equals(content)) {
        same++;
        continue;
      }
      if (!force) {
        conflicts.push(rel);
        continue;
      }
    } else {
      created.push(rel);
    }
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
    written++;
  }
  if (!quiet || written > 0) console.log(`vault: ${written} unlocked, ${same} already current, ${conflicts.length} local edits kept`);
  for (const rel of conflicts) console.log(`  local copy differs from vault, kept yours: ${rel}  (lock to publish it, or unlock --force)`);
  // A freshly created CLAUDE.md may have been missed by the tool that loads it at startup;
  // print it so it still reaches the session that ran this as a hook.
  if (quiet && created.includes("CLAUDE.md")) {
    console.log("\n--- CLAUDE.md (unlocked just now) ---\n");
    console.log(readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8"));
  }
}

function status() {
  const key = readKey();
  const present = plaintextFiles();
  if (!key) {
    console.log(`vault: no key. ${vaultFiles().length} encrypted file(s), ${present.length} plaintext file(s) present.`);
    return;
  }
  const entries = readVault(key);
  const rows = [];
  for (const rel of present) {
    const entry = entries.get(rel);
    if (!entry) rows.push(["NEW     ", rel]);
    else if (!entry.content.equals(readFileSync(path.join(ROOT, rel)))) rows.push(["MODIFIED", rel]);
    else rows.push(["ok      ", rel]);
  }
  for (const rel of entries.keys()) if (!present.includes(rel)) rows.push(["LOCKED  ", rel]);
  for (const [state, rel] of rows.sort((a, b) => a[1].localeCompare(b[1]))) console.log(`${state} ${rel}`);
  const dirty = rows.filter(([s]) => s.trim() !== "ok").length;
  console.log(dirty ? `\n${dirty} file(s) need attention (lock or unlock).` : "\nvault and plaintext are in sync.");
}

function selftest() {
  const pass = randomBytes(8).toString("hex");
  const content = Buffer.from("héllo vault ✓ " + "x".repeat(5000), "utf8");
  const enc = encrypt(pass, "docs/ai/TEST.md", content);
  const dec = decrypt(pass, enc);
  if (dec.path !== "docs/ai/TEST.md" || !dec.content.equals(content)) throw new Error("round trip failed");
  let wrongKeyRejected = false;
  try {
    decrypt(pass + "x", enc);
  } catch {
    wrongKeyRejected = true;
  }
  if (!wrongKeyRejected) throw new Error("wrong key was accepted");
  const lines = enc.split("\n");
  const tampered = lines[0] + "\n" + lines[1].replace(/[A-Za-z]/, (c) => (c === "A" ? "B" : "A")) + "\n" + lines.slice(2).join("\n");
  let tamperRejected = false;
  try {
    decrypt(pass, tampered);
  } catch {
    tamperRejected = true;
  }
  if (!tamperRejected) throw new Error("tampered file was accepted");
  if (vaultFileName(pass, "a") === vaultFileName(pass, "b")) throw new Error("name collision");
  console.log("vault selftest: ok");
}

function requireKey() {
  const key = readKey();
  if (!key) {
    console.error(`vault: no key. Set ${KEY_ENV} or create ${path.relative(ROOT, KEY_FILE)}.`);
    process.exit(2);
  }
  return key;
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
try {
  switch (command) {
    case "lock":
      lock({ prune: flags.has("--prune") });
      break;
    case "unlock":
      unlock({ force: flags.has("--force"), quiet: flags.has("--quiet") });
      break;
    case "status":
      status();
      break;
    case "selftest":
      selftest();
      break;
    default:
      console.log("usage: node scripts/vault.mjs <lock [--prune] | unlock [--force] [--quiet] | status | selftest>");
      process.exit(command ? 1 : 0);
  }
} catch (err) {
  console.error(`vault: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
