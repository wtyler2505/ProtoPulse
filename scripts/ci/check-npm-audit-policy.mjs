#!/usr/bin/env node
/* global console, process */

import fs from 'node:fs';

const [, , auditPath, allowlistPath] = process.argv;

if (!auditPath || !allowlistPath) {
  console.error('Usage: check-npm-audit-policy.mjs <audit-json> <allowlist-json>');
  process.exit(2);
}

const severityRank = new Map([
  ['info', 0],
  ['low', 1],
  ['moderate', 2],
  ['high', 3],
  ['critical', 4],
]);

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read JSON from ${path}: ${message}`);
    process.exit(2);
  }
}

function isExpired(until) {
  const expiresAt = Date.parse(`${until}T23:59:59Z`);
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return Date.now() > expiresAt;
}

function viaMatches(via, allowed) {
  if (typeof via === 'string') {
    return via === allowed;
  }
  if (!via || typeof via !== 'object') {
    return false;
  }
  return [via.source, via.name, via.dependency, via.title, via.url]
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .some((value) => value === allowed || value.includes(allowed));
}

function isAllowed(vulnerability, allowlist) {
  return allowlist.allow.some((entry) => {
    if (entry.name !== vulnerability.name) {
      return false;
    }
    if (entry.maxSeverity && severityRank.get(vulnerability.severity) > severityRank.get(entry.maxSeverity)) {
      return false;
    }
    if (entry.until && isExpired(entry.until)) {
      return false;
    }
    if (entry.requireNoFixAvailable && vulnerability.fixAvailable !== false) {
      return false;
    }
    if (entry.allowedVia) {
      const via = vulnerability.via ?? [];
      if (via.length === 0) {
        return false;
      }
      if (via.some((item) => !entry.allowedVia.some((allowed) => viaMatches(item, allowed)))) {
        return false;
      }
    }
    return true;
  });
}

const audit = readJson(auditPath);
const allowlist = readJson(allowlistPath);
const vulnerabilities = Object.values(audit.vulnerabilities ?? {});

const blocking = [];
const allowed = [];

for (const vulnerability of vulnerabilities) {
  const rank = severityRank.get(vulnerability.severity) ?? -1;
  if (rank < severityRank.get('high')) {
    continue;
  }
  if (isAllowed(vulnerability, allowlist)) {
    allowed.push(vulnerability);
  } else {
    blocking.push(vulnerability);
  }
}

if (allowed.length > 0) {
  console.log('[npm-audit-policy] allowed high advisories:');
  for (const vulnerability of allowed) {
    console.log(`  - ${vulnerability.name}@${vulnerability.range} (${vulnerability.severity}, fixAvailable=${String(vulnerability.fixAvailable)})`);
  }
}

if (blocking.length > 0) {
  console.error('[npm-audit-policy] blocking high/critical advisories:');
  for (const vulnerability of blocking) {
    console.error(`  - ${vulnerability.name}@${vulnerability.range} (${vulnerability.severity}, fixAvailable=${JSON.stringify(vulnerability.fixAvailable)})`);
  }
  process.exit(1);
}

console.log('[npm-audit-policy] no unapproved high/critical npm advisories');
