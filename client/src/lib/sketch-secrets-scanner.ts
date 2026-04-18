/**
 * Sketch Secrets Scanner
 *
 * Scans Arduino/embedded sketch source code for accidentally embedded secrets
 * such as WiFi passwords, API keys, tokens, AWS credentials, private keys,
 * database connection strings, and other sensitive data.
 *
 * Designed to run client-side before firmware upload or code sharing to prevent
 * accidental credential leaks — critical for the maker audience who often
 * hardcode WiFi passwords and cloud API keys directly in their sketches.
 *
 * Usage:
 *   const result = scanSketchForSecrets(sketchCode);
 *   if (shouldBlockUpload(result)) {
 *     logger.warn(formatFindings(result.findings));
 *   }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretSeverity = 'critical' | 'warning';

export interface SecretPattern {
  /** Human-readable name for the pattern (e.g., "WiFi Password"). */
  name: string;
  /** Regular expression used to detect the secret. */
  regex: RegExp;
  /** Severity level: critical blocks upload, warning is advisory. */
  severity: SecretSeverity;
}

export interface SecretFinding {
  /** 1-based line number where the secret was found. */
  line: number;
  /** 0-based column offset within the line. */
  column: number;
  /** The pattern that matched. */
  pattern: SecretPattern;
  /** Redacted snippet showing the surrounding context. */
  snippet: string;
  /** Severity inherited from the matched pattern. */
  severity: SecretSeverity;
}

export interface ScanResult {
  /** All findings detected in the scanned code. */
  findings: SecretFinding[];
  /** True when no findings were detected. */
  clean: boolean;
  /** Total number of lines scanned. */
  scannedLines: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum length of the redacted snippet shown in findings. */
const MAX_SNIPPET_LENGTH = 80;

/** Number of characters to keep visible at the start/end of a redacted value. */
const REDACT_VISIBLE_CHARS = 3;

// ---------------------------------------------------------------------------
// Built-in Patterns (15+)
// ---------------------------------------------------------------------------

export const BUILTIN_PATTERNS: SecretPattern[] = [
  // --- Critical: credentials that grant access ---
  {
    name: 'WiFi Password',
    regex: /(?:wifi|wlan|ssid|wpa|network)[\s_-]*(?:pass(?:word|phrase)?|psk|key)\s*(?:=|:|\()\s*["']([^"']{4,})["']/i,
    severity: 'critical',
  },
  {
    name: 'WiFi Password (Arduino WiFi.begin)',
    regex: /WiFi\.begin\s*\(\s*["'][^"']*["']\s*,\s*["']([^"']{4,})["']\s*\)/,
    severity: 'critical',
  },
  {
    name: 'Generic API Key',
    regex: /(?:api|app)[\s_-]*(?:key|secret|token)\s*(?:=|:|\()\s*["']([A-Za-z0-9_\-/.]{16,})["']/i,
    severity: 'critical',
  },
  {
    name: 'AWS Access Key ID',
    regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/,
    severity: 'critical',
  },
  {
    name: 'AWS Secret Access Key',
    regex: /(?:aws[\s_-]*)?secret[\s_-]*(?:access[\s_-]*)?key\s*(?:=|:)\s*["']([A-Za-z0-9/+=]{30,})["']/i,
    severity: 'critical',
  },
  {
    name: 'Bearer Token',
    regex: /(?:bearer|authorization)\s*(?:=|:|\()\s*["'](?:Bearer\s+)?([A-Za-z0-9_\-/.]{20,})["']/i,
    severity: 'critical',
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/,
    severity: 'critical',
  },
  {
    name: 'Database Connection String',
    regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"']{10,}/i,
    severity: 'critical',
  },
  {
    name: 'Generic Password Assignment',
    regex: /(?:password|passwd|pwd)\s*(?:=|:)\s*["']([^"']{4,})["']/i,
    severity: 'critical',
  },
  {
    name: 'GitHub Token',
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/,
    severity: 'critical',
  },
  {
    name: 'Slack Token',
    regex: /xox[bpras]-[A-Za-z0-9\-]{10,}/,
    severity: 'critical',
  },
  {
    name: 'JWT Token',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-+/=]{10,}/,
    severity: 'critical',
  },
  // --- Warning: suspicious but may be false positives ---
  {
    name: 'Base64 Encoded Secret',
    regex: /(?:secret|credential|token|auth)[\s_-]*(?:=|:)\s*["'](?:[A-Za-z0-9+/]{32,}={0,2})["']/i,
    severity: 'warning',
  },
  {
    name: 'Hex Encoded Secret',
    regex: /(?:secret|key|token)[\s_-]*(?:=|:)\s*["'](?:0x)?([0-9a-fA-F]{32,})["']/i,
    severity: 'warning',
  },
  {
    name: 'Hardcoded IP with Port',
    regex: /(?:host|server|endpoint|url)\s*(?:=|:)\s*["']\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}["']/i,
    severity: 'warning',
  },
  {
    name: 'MQTT Broker Credentials',
    regex: /mqtt[\s_-]*(?:user(?:name)?|pass(?:word)?)\s*(?:=|:)\s*["']([^"']{4,})["']/i,
    severity: 'warning',
  },
  {
    name: 'Blynk Auth Token',
    regex: /(?:blynk|BLYNK)[\s_-]*(?:auth|token)\s*(?:=|:)\s*["']([A-Za-z0-9]{20,})["']/i,
    severity: 'warning',
  },
  {
    name: 'ThingSpeak API Key',
    regex: /(?:thingspeak|THINGSPEAK)[\s_-]*(?:api[\s_-]*key|write[\s_-]*key|read[\s_-]*key)\s*(?:=|:)\s*["']([A-Za-z0-9]{10,})["']/i,
    severity: 'warning',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Redact the middle portion of a matched secret value in a snippet,
 * keeping a few characters visible at each end for identification.
 */
function redactSnippet(line: string, matchStart: number, matchEnd: number): string {
  const matchText = line.slice(matchStart, matchEnd);

  // Only redact if the match is long enough to meaningfully hide something
  if (matchText.length <= REDACT_VISIBLE_CHARS * 2 + 3) {
    const redacted = '*'.repeat(matchText.length);
    const result = line.slice(0, matchStart) + redacted + line.slice(matchEnd);
    return truncateSnippet(result, matchStart);
  }

  const prefix = matchText.slice(0, REDACT_VISIBLE_CHARS);
  const suffix = matchText.slice(-REDACT_VISIBLE_CHARS);
  const redactedLength = matchText.length - REDACT_VISIBLE_CHARS * 2;
  const redacted = prefix + '*'.repeat(redactedLength) + suffix;

  const result = line.slice(0, matchStart) + redacted + line.slice(matchEnd);
  return truncateSnippet(result, matchStart);
}

/**
 * Truncate a snippet to MAX_SNIPPET_LENGTH, centering around the match position.
 */
function truncateSnippet(text: string, matchStart: number): string {
  if (text.length <= MAX_SNIPPET_LENGTH) {
    return text;
  }

  const halfWindow = Math.floor(MAX_SNIPPET_LENGTH / 2);
  let start = Math.max(0, matchStart - halfWindow);
  let end = start + MAX_SNIPPET_LENGTH;

  if (end > text.length) {
    end = text.length;
    start = Math.max(0, end - MAX_SNIPPET_LENGTH);
  }

  let snippet = text.slice(start, end);
  if (start > 0) {
    snippet = '...' + snippet.slice(3);
  }
  if (end < text.length) {
    snippet = snippet.slice(0, -3) + '...';
  }

  return snippet;
}

/**
 * Check if a line is inside a comment block or a single-line comment.
 * We still scan comments because secrets in comments are still secrets —
 * but this helper can be used for additional heuristics in the future.
 */
export function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Scan sketch source code for embedded secrets.
 *
 * Applies all built-in patterns plus any additional custom patterns against
 * every line of the source code. Secrets inside comments are still flagged
 * because commented-out credentials are a common source of leaks.
 *
 * @param code - The full sketch source code to scan.
 * @param extraPatterns - Optional additional patterns to include in the scan.
 * @returns A ScanResult with all findings, a clean flag, and line count.
 */
export function scanSketchForSecrets(
  code: string,
  extraPatterns?: SecretPattern[],
): ScanResult {
  const patterns = extraPatterns
    ? [...BUILTIN_PATTERNS, ...extraPatterns]
    : BUILTIN_PATTERNS;

  const lines = code.split('\n');
  const findings: SecretFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of patterns) {
      const match = pattern.regex.exec(line);
      if (match) {
        const column = match.index;
        const matchEnd = column + match[0].length;
        const snippet = redactSnippet(line, column, matchEnd);

        findings.push({
          line: i + 1,
          column,
          pattern,
          snippet,
          severity: pattern.severity,
        });
      }
    }
  }

  return {
    findings,
    clean: findings.length === 0,
    scannedLines: lines.length,
  };
}

/**
 * Determine whether a scan result should block firmware upload.
 *
 * Returns true if any finding has severity 'critical'. Warnings alone
 * do not block upload — they are advisory.
 */
export function shouldBlockUpload(result: ScanResult): boolean {
  return result.findings.some((f) => f.severity === 'critical');
}

/**
 * Format findings into a human-readable report string.
 *
 * Each finding is rendered as a multi-line block showing severity,
 * pattern name, location, and the redacted snippet.
 */
export function formatFindings(findings: SecretFinding[]): string {
  if (findings.length === 0) {
    return 'No secrets detected.';
  }

  const header = `Found ${findings.length} potential secret${findings.length === 1 ? '' : 's'}:\n`;

  const blocks = findings.map((f, idx) => {
    const severityTag = f.severity === 'critical' ? '[CRITICAL]' : '[WARNING]';
    const lines = [
      `  ${idx + 1}. ${severityTag} ${f.pattern.name}`,
      `     Location: line ${f.line}, column ${f.column}`,
      `     Snippet:  ${f.snippet}`,
    ];
    return lines.join('\n');
  });

  return header + blocks.join('\n\n');
}
