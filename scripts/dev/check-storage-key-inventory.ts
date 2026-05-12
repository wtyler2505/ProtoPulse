#!/usr/bin/env tsx
/**
 * scripts/dev/check-storage-key-inventory.ts
 *
 * Drift detector: regenerates the storage-key inventory to a temp file and
 * diffs against the committed JSON. Fails CI if drift.
 *
 * Used by CI / pre-commit to catch developers who add a literal localStorage
 * key without re-running the generator (which would update the committed
 * inventory + classifier).
 */

import { execSync } from 'node:child_process';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMMITTED_PATH = resolve(
  __dirname,
  '../../client/src/lib/desktop/storage-key-inventory.json',
);
const GENERATOR_PATH = resolve(__dirname, 'generate-storage-key-inventory.ts');

function main(): void {
  if (!existsSync(COMMITTED_PATH)) {
    console.error(`[inventory-check] committed inventory missing at ${COMMITTED_PATH}`);
    console.error(`[inventory-check] run: tsx ${GENERATOR_PATH}`);
    process.exit(1);
  }

  const committed = readFileSync(COMMITTED_PATH, 'utf8');
  const tmpDir = mkdtempSync(resolve(tmpdir(), 'protopulse-inventory-check-'));
  const tmpOut = resolve(tmpDir, 'storage-key-inventory.json');

  try {
    execSync(`tsx ${GENERATOR_PATH}`, {
      stdio: ['inherit', 'pipe', 'inherit'],
      env: { ...process.env, STORAGE_INVENTORY_OUT: tmpOut },
    });
  } catch (e) {
    console.error(`[inventory-check] generator failed:`, e instanceof Error ? e.message : e);
    process.exit(2);
  }

  if (!existsSync(tmpOut)) {
    console.error(`[inventory-check] generator did not write expected output at ${tmpOut}`);
    process.exit(3);
  }

  const regenerated = readFileSync(tmpOut, 'utf8');

  if (regenerated !== committed) {
    console.error('[inventory-check] DRIFT detected between committed and regenerated inventory.');
    console.error(`[inventory-check] regenerated: ${tmpOut}`);
    console.error(`[inventory-check] committed:   ${COMMITTED_PATH}`);
    console.error('[inventory-check] run: tsx scripts/dev/generate-storage-key-inventory.ts');
    process.exit(4);
  }

  console.log(`[inventory-check] OK — committed inventory matches regenerated output`);
}

main();
