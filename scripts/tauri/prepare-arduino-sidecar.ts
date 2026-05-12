/**
 * Phase 9.2 — Arduino CLI sidecar prep (R4 retro Wave 8 / C12+C23).
 *
 * Downloads the appropriate arduino-cli binary per target triple and renames
 * it to the `src-tauri/binaries/arduino-cli-<target-triple>(.exe)` convention
 * Tauri's `bundle.externalBin` expects (see https://v2.tauri.app/develop/sidecar).
 *
 * R4 retro Wave 8 changes:
 *   - ARDUINO_CLI_VERSION bumped to 1.4.1 (current Latest verified
 *     2026-05-12 via gh api repos/arduino/arduino-cli/releases/latest).
 *   - SHA256 verification now ENFORCED (previous version only had comments
 *     claiming it; no actual implementation). Hashes pulled from
 *     https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt
 *     verified 2026-05-12.
 *   - mkdtempSync(0700) private temp dir replaces predictable `/tmp/${spec.asset}`
 *     (closes TOCTOU between download and extract).
 *   - Extended target matrix: ARMv7 + ARMv6 + Linux 32-bit + Windows 32-bit
 *     entries reserved (not in current CI matrix per
 *     docs/audits/tauri-hardware-plugin-provenance.md target-matrix policy).
 *
 * Run on each CI host BEFORE `tauri build`:
 *
 *     npx tsx scripts/tauri/prepare-arduino-sidecar.ts --target <triple>
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pinned arduino-cli version. Bump deliberately; the bundled binary IS the
 * runtime, so version drift = test drift. R4 retro Wave 8 verified 2026-05-12.
 */
const ARDUINO_CLI_VERSION = "1.4.1";

/**
 * Target-triple → arduino-cli release asset + pinned SHA256.
 *
 * Current CI matrix uses: x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu
 * (reserved, not yet in workflow), x86_64-apple-darwin, aarch64-apple-darwin,
 * x86_64-pc-windows-msvc. Additional entries (armv7, i686-linux, arm-linux,
 * i686-windows) are reserved for future matrix expansion per the audit doc's
 * target-matrix policy.
 *
 * Hashes verified 2026-05-12 against
 * https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt
 */
const TARGET_TO_ASSET: Record<
  string,
  { asset: string; ext: "tar.gz" | "zip"; arduinoBinary: string; sha256: string }
> = {
  "x86_64-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "683cf2a6b8953e3d632e7e4512c36667839d2073349c4b6d312e4c67592359bd",
  },
  "aarch64-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "93159a5e27af6dab03bd3b5a441c86092d83c0422a5c17d0afc2ac21aee83612",
  },
  "x86_64-apple-darwin": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_64bit.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "3f2de15a37e580301eb8618fb6fd931ed0b7a8b044f0809a0ac6d20879400a7c",
  },
  "aarch64-apple-darwin": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_ARM64.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "d9d19a3cc8e6e28d138c435e1055a0388c984827e93fccbd352fe5dac685a02b",
  },
  "x86_64-pc-windows-msvc": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Windows_64bit.zip`,
    ext: "zip",
    arduinoBinary: "arduino-cli.exe",
    sha256: "44f506a29d134cb294898d5f729aea85e5498f5d81ff5fc63c549087c45a20a3",
  },
  // ── R4 retro Wave 8 reserved entries (not in current CI matrix) ───────
  "armv7-unknown-linux-gnueabihf": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARMv7.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "71cf6cb5e7ba01dbd0809bcccaa0452f337f0976fe688e83e870bbc81717cee7",
  },
  "arm-unknown-linux-gnueabihf": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARMv6.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "16121108a400f62d71bb0269e90d31dc469dbbceb470a670768713f35808533a",
  },
  "i686-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_32bit.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "85eb4b14247cd09103c88a31c3eaf576f954334bf15a309f4ccf1c9f760030a0",
  },
  "i686-pc-windows-msvc": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Windows_32bit.zip`,
    ext: "zip",
    arduinoBinary: "arduino-cli.exe",
    sha256: "e6558c8b7fd6b3e6141c0dab01cd9d39e635872059b1dbd89bbfc9913c29c824",
  },
};

function getTargetTriple(): string {
  const flagIdx = process.argv.indexOf("--target");
  if (flagIdx >= 0 && process.argv[flagIdx + 1]) {
    return process.argv[flagIdx + 1];
  }
  const out = execSync("rustc --print host-tuple", { encoding: "utf8" }).trim();
  return out;
}

function downloadAsset(url: string, dest: string): void {
  console.log(`[arduino-sidecar] downloading ${url}`);
  execSync(`curl -fL -o "${dest}" "${url}"`, { stdio: "inherit" });
}

function verifySha256(filePath: string, expectedHex: string): void {
  const buf = readFileSync(filePath);
  const actual = createHash("sha256").update(buf).digest("hex");
  if (actual !== expectedHex) {
    console.error(
      `[arduino-sidecar] SHA256 mismatch for ${filePath}:\n` +
        `  expected: ${expectedHex}\n` +
        `  actual:   ${actual}\n` +
        `If ARDUINO_CLI_VERSION was bumped, refresh hashes from\n` +
        `  https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/${ARDUINO_CLI_VERSION}-checksums.txt`,
    );
    process.exit(1);
  }
  console.log(`[arduino-sidecar] SHA256 OK: ${filePath}`);
}

function extractArchive(archivePath: string, ext: string, destDir: string): void {
  console.log(`[arduino-sidecar] extracting ${archivePath} → ${destDir}`);
  mkdirSync(destDir, { recursive: true });
  if (ext === "tar.gz") {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: "inherit" });
  } else if (ext === "zip") {
    execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: "inherit" });
  } else {
    throw new Error(`unsupported archive ext: ${ext}`);
  }
}

function main(): void {
  // R4 retro Wave 7 (C7): SKIP_ARDUINO_SIDECAR dev opt-out with safety check
  // — refuse to skip if externalBin is declared in tauri.conf.json.
  if (process.env.SKIP_ARDUINO_SIDECAR === "1") {
    const tauriConfPath = resolve(__dirname, "..", "..", "src-tauri", "tauri.conf.json");
    const tauriConf = readFileSync(tauriConfPath, "utf8");
    if (tauriConf.includes('"externalBin"')) {
      console.error(
        "[arduino-sidecar] SKIP_ARDUINO_SIDECAR=1 but tauri.conf.json declares bundle.externalBin. " +
          "Skipping would produce a broken bundle. Either set SKIP_ARDUINO_SIDECAR=0 or remove externalBin.",
      );
      process.exit(1);
    }
    console.log("[arduino-sidecar] SKIP_ARDUINO_SIDECAR=1 (dev opt-out, no externalBin declared)");
    return;
  }

  const target = getTargetTriple();
  const spec = TARGET_TO_ASSET[target];
  if (!spec) {
    console.error(
      `[arduino-sidecar] no asset mapping for target '${target}'.\n` +
        `Add it to TARGET_TO_ASSET in scripts/tauri/prepare-arduino-sidecar.ts. ` +
        `Supported targets: ${Object.keys(TARGET_TO_ASSET).join(", ")}.`,
    );
    process.exit(1);
  }

  // R4 retro Wave 8 (C12): private temp dir with 0700 perms — replaces the
  // predictable `/tmp/${spec.asset}` that had a same-user TOCTOU.
  const tempDir = mkdtempSync(resolve(tmpdir(), "protopulse-arduino-"));
  chmodSync(tempDir, 0o700);

  try {
    const baseUrl = `https://downloads.arduino.cc/arduino-cli/${spec.asset}`;
    const archivePath = resolve(tempDir, spec.asset);
    const extractDir = resolve(tempDir, "extracted");

    downloadAsset(baseUrl, archivePath);
    verifySha256(archivePath, spec.sha256);
    extractArchive(archivePath, spec.ext, extractDir);

    const extractedBinary = resolve(extractDir, spec.arduinoBinary);
    if (!existsSync(extractedBinary)) {
      console.error(
        `[arduino-sidecar] extracted archive did not contain expected binary at ${extractedBinary}`,
      );
      process.exit(1);
    }

    // Per https://v2.tauri.app/develop/sidecar, externalBin entries are
    // rewritten per target triple at bundle time. The binary name must follow
    // `<base-name>-<target-triple>(.exe)` so Tauri can find it.
    const ext = target.endsWith("msvc") ? ".exe" : "";
    const binariesDir = resolve(__dirname, "..", "..", "src-tauri", "binaries");
    mkdirSync(binariesDir, { recursive: true });
    const finalPath = resolve(binariesDir, `arduino-cli-${target}${ext}`);
    renameSync(extractedBinary, finalPath);

    if (!target.endsWith("msvc")) {
      chmodSync(finalPath, 0o755);
    }

    console.log(`[arduino-sidecar] wrote ${finalPath}`);
    console.log(`[arduino-sidecar] tauri.conf.json bundle.externalBin = ["binaries/arduino-cli"]`);
    console.log(`[arduino-sidecar] Tauri will pick up arduino-cli-${target}${ext} per target triple`);
  } finally {
    // Cleanup private temp dir regardless of success/failure.
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
