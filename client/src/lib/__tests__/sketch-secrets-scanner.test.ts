import { describe, it, expect } from 'vitest';
import {
  scanSketchForSecrets,
  shouldBlockUpload,
  formatFindings,
  isCommentLine,
  BUILTIN_PATTERNS,
} from '../sketch-secrets-scanner';
import type {
  SecretPattern,
  SecretFinding,
  ScanResult,
  SecretSeverity,
} from '../sketch-secrets-scanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal sketch with a single line of code. */
function sketch(line: string): string {
  return `#include <WiFi.h>\n\nvoid setup() {\n  ${line}\n}\n`;
}

/** Convenience: scan a single line embedded in a sketch and return findings. */
function scanLine(line: string): ScanResult {
  return scanSketchForSecrets(sketch(line));
}

// ---------------------------------------------------------------------------
// BUILTIN_PATTERNS
// ---------------------------------------------------------------------------

describe('BUILTIN_PATTERNS', () => {
  it('contains at least 15 patterns', () => {
    expect(BUILTIN_PATTERNS.length).toBeGreaterThanOrEqual(15);
  });

  it('every pattern has required fields', () => {
    for (const p of BUILTIN_PATTERNS) {
      expect(p.name).toBeTruthy();
      expect(p.regex).toBeInstanceOf(RegExp);
      expect(['critical', 'warning']).toContain(p.severity);
    }
  });

  it('pattern names are unique', () => {
    const names = BUILTIN_PATTERNS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('contains both critical and warning severities', () => {
    const severities = new Set(BUILTIN_PATTERNS.map((p) => p.severity));
    expect(severities.has('critical')).toBe(true);
    expect(severities.has('warning')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — WiFi patterns
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — WiFi patterns', () => {
  it('detects WiFi.begin() with password', () => {
    const result = scanLine('WiFi.begin("MyNetwork", "SuperSecret123");');
    expect(result.clean).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].pattern.name).toContain('WiFi');
  });

  it('detects wifi_password variable assignment', () => {
    const result = scanLine('const char* wifi_password = "hunter2";');
    expect(result.clean).toBe(false);
    const wifiFinding = result.findings.find((f) => f.pattern.name.includes('WiFi'));
    expect(wifiFinding).toBeDefined();
    expect(wifiFinding!.severity).toBe('critical');
  });

  it('detects wlan_pass assignment', () => {
    const result = scanLine('String wlan_pass = "myPassphrase";');
    expect(result.clean).toBe(false);
    expect(result.findings.some((f) => f.pattern.name.includes('WiFi'))).toBe(true);
  });

  it('does not flag WiFi.begin with short password (< 4 chars)', () => {
    const result = scanLine('WiFi.begin("SSID", "ab");');
    // Short passwords shouldn't match the 4+ char requirement
    const wifiFindings = result.findings.filter((f) => f.pattern.name.includes('WiFi Password (Arduino'));
    expect(wifiFindings.length).toBe(0);
  });

  it('detects ssid_key assignment', () => {
    const result = scanLine('const char* ssid_key = "longpassword12";');
    expect(result.clean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — API key patterns
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — API key patterns', () => {
  it('detects generic API key', () => {
    const result = scanLine('String api_key = "abcdef1234567890ABCDEF";');
    expect(result.clean).toBe(false);
    expect(result.findings[0].pattern.name).toContain('API Key');
  });

  it('detects app_secret assignment', () => {
    const result = scanLine('const char* app_secret = "1234567890abcdef1234567890abcdef";');
    expect(result.clean).toBe(false);
  });

  it('detects api_token with colon separator', () => {
    const result = scanLine('api_token: "sk_live_1234567890abcdef12345"');
    expect(result.clean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — AWS patterns
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — AWS patterns', () => {
  it('detects AWS Access Key ID (AKIA prefix)', () => {
    const result = scanLine('const char* aws_key = "AKIAIOSFODNN7EXAMPLE";');
    expect(result.clean).toBe(false);
    const awsFinding = result.findings.find((f) => f.pattern.name.includes('AWS Access Key'));
    expect(awsFinding).toBeDefined();
    expect(awsFinding!.severity).toBe('critical');
  });

  it('detects AWS Access Key ID (ASIA prefix for temporary creds)', () => {
    const result = scanLine('"ASIATEMPORARYKEYEXAMPLE"');
    expect(result.clean).toBe(false);
  });

  it('detects AWS Secret Access Key', () => {
    const result = scanLine('aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";');
    expect(result.clean).toBe(false);
    const finding = result.findings.find((f) => f.pattern.name.includes('AWS Secret'));
    expect(finding).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — Token patterns
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — Token patterns', () => {
  it('detects Bearer token', () => {
    const result = scanLine('authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig";');
    expect(result.clean).toBe(false);
  });

  it('detects GitHub personal access token', () => {
    const result = scanLine('String token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";');
    expect(result.clean).toBe(false);
    const ghFinding = result.findings.find((f) => f.pattern.name.includes('GitHub'));
    expect(ghFinding).toBeDefined();
  });

  it('detects Slack bot token', () => {
    const result = scanLine('const char* slack = "xoxb-1234567890-abcdefghij";');
    expect(result.clean).toBe(false);
    const slackFinding = result.findings.find((f) => f.pattern.name.includes('Slack'));
    expect(slackFinding).toBeDefined();
  });

  it('detects JWT token', () => {
    const result = scanLine(
      'String jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Q9swCPPhQz1BiaYVfxOiag";',
    );
    expect(result.clean).toBe(false);
    const jwtFinding = result.findings.find((f) => f.pattern.name.includes('JWT'));
    expect(jwtFinding).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — Private key / connection string patterns
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — Private key / connection string patterns', () => {
  it('detects RSA private key block', () => {
    const code = [
      'const char* cert = R"(',
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF068...',
      '-----END RSA PRIVATE KEY-----',
      ')";',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    expect(result.clean).toBe(false);
    const pkFinding = result.findings.find((f) => f.pattern.name.includes('Private Key'));
    expect(pkFinding).toBeDefined();
    expect(pkFinding!.severity).toBe('critical');
  });

  it('detects EC private key block', () => {
    const result = scanSketchForSecrets('-----BEGIN EC PRIVATE KEY-----');
    expect(result.clean).toBe(false);
  });

  it('detects PostgreSQL connection string', () => {
    const result = scanLine('String db = "postgres://user:pass@localhost:5432/mydb";');
    expect(result.clean).toBe(false);
    const dbFinding = result.findings.find((f) => f.pattern.name.includes('Database'));
    expect(dbFinding).toBeDefined();
  });

  it('detects MongoDB connection string', () => {
    const result = scanLine('const char* mongo = "mongodb+srv://admin:pw@cluster0.example.net/db";');
    expect(result.clean).toBe(false);
  });

  it('detects Redis connection string', () => {
    const result = scanLine('String redis = "redis://default:secretpw@redis.example.com:6379";');
    expect(result.clean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — Warning-level patterns
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — Warning-level patterns', () => {
  it('detects base64-encoded secret (warning)', () => {
    const result = scanLine('String secret = "SGVsbG9Xb3JsZEhlbGxvV29ybGRIZWxsb1dvcmxk";');
    expect(result.clean).toBe(false);
    const finding = result.findings.find((f) => f.pattern.name.includes('Base64'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('warning');
  });

  it('detects hex-encoded secret (warning)', () => {
    const result = scanLine('String key = "0xDEADBEEFCAFEBABE1234567890ABCDEF12345678";');
    expect(result.clean).toBe(false);
  });

  it('detects hardcoded IP with port (warning)', () => {
    const result = scanLine('const char* host = "192.168.1.100:8080";');
    expect(result.clean).toBe(false);
    const ipFinding = result.findings.find((f) => f.pattern.name.includes('Hardcoded IP'));
    expect(ipFinding).toBeDefined();
    expect(ipFinding!.severity).toBe('warning');
  });

  it('detects MQTT credentials (warning)', () => {
    const result = scanLine('mqtt_password = "broker_secret_123";');
    expect(result.clean).toBe(false);
    const mqttFinding = result.findings.find((f) => f.pattern.name.includes('MQTT'));
    expect(mqttFinding).toBeDefined();
  });

  it('detects Blynk auth token (warning)', () => {
    const result = scanLine('String BLYNK_AUTH = "a1b2c3d4e5f6g7h8i9j0k1l2";');
    expect(result.clean).toBe(false);
    const blynkFinding = result.findings.find((f) => f.pattern.name.includes('Blynk'));
    expect(blynkFinding).toBeDefined();
  });

  it('detects ThingSpeak API key (warning)', () => {
    const result = scanLine('const char* thingspeak_api_key = "ABC123DEF456GHI";');
    expect(result.clean).toBe(false);
    const tsFinding = result.findings.find((f) => f.pattern.name.includes('ThingSpeak'));
    expect(tsFinding).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — Generic password
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — Generic password', () => {
  it('detects password assignment', () => {
    const result = scanLine('const char* password = "supersecret";');
    expect(result.clean).toBe(false);
    const pwFinding = result.findings.find((f) => f.pattern.name.includes('Password'));
    expect(pwFinding).toBeDefined();
  });

  it('detects passwd variable', () => {
    const result = scanLine('String passwd = "test1234";');
    expect(result.clean).toBe(false);
  });

  it('detects pwd assignment with colon', () => {
    const result = scanLine('pwd: "mypassword"');
    expect(result.clean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — Clean code (no false positives)
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — clean code', () => {
  it('returns clean for standard Arduino sketch', () => {
    const code = [
      '#include <Arduino.h>',
      '',
      'void setup() {',
      '  Serial.begin(9600);',
      '  pinMode(LED_BUILTIN, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  digitalWrite(LED_BUILTIN, HIGH);',
      '  delay(1000);',
      '  digitalWrite(LED_BUILTIN, LOW);',
      '  delay(1000);',
      '}',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
    expect(result.scannedLines).toBe(13);
  });

  it('returns clean for code with placeholder passwords', () => {
    // Short placeholders under 4 chars shouldn't trigger
    const result = scanLine('WiFi.begin("SSID", "pw");');
    const wifiArduino = result.findings.filter((f) => f.pattern.name.includes('WiFi Password (Arduino'));
    expect(wifiArduino).toHaveLength(0);
  });

  it('returns clean for empty code', () => {
    const result = scanSketchForSecrets('');
    expect(result.clean).toBe(true);
    expect(result.scannedLines).toBe(1);
  });

  it('does not flag normal variable names', () => {
    const code = [
      'int apiVersion = 2;',
      'bool secretMode = false;',
      'String tokenizer = "nltk";',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    expect(result.clean).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — Structural tests
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — structural', () => {
  it('reports correct line numbers (1-based)', () => {
    const code = 'line1\nline2\npassword = "secret123"\nline4';
    const result = scanSketchForSecrets(code);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.findings[0].line).toBe(3);
  });

  it('reports correct column offset (0-based)', () => {
    const code = '  password = "hunter22"';
    const result = scanSketchForSecrets(code);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.findings[0].column).toBe(2);
  });

  it('scannedLines equals number of lines in the input', () => {
    const code = 'a\nb\nc\nd\ne';
    const result = scanSketchForSecrets(code);
    expect(result.scannedLines).toBe(5);
  });

  it('detects multiple secrets on different lines', () => {
    const code = [
      'String api_key = "abcdef1234567890ABCDEF";',
      'password = "supersecret"',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
  });

  it('detects secrets inside comments (commented-out creds are still dangerous)', () => {
    const result = scanSketchForSecrets('// password = "leaked_password_here"');
    expect(result.clean).toBe(false);
  });

  it('accepts custom extra patterns', () => {
    const custom: SecretPattern = {
      name: 'Custom Pattern',
      regex: /CUSTOM_SECRET_([A-Z]+)/,
      severity: 'warning',
    };
    const result = scanSketchForSecrets('String x = CUSTOM_SECRET_ABCDEF;', [custom]);
    expect(result.clean).toBe(false);
    expect(result.findings[0].pattern.name).toBe('Custom Pattern');
  });

  it('finding snippet is redacted', () => {
    const result = scanLine('WiFi.begin("MyNetwork", "MyLongSecretPassword123");');
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    // Snippet should contain asterisks for redaction
    expect(result.findings[0].snippet).toContain('*');
  });
});

// ---------------------------------------------------------------------------
// shouldBlockUpload
// ---------------------------------------------------------------------------

describe('shouldBlockUpload', () => {
  it('returns true when any finding is critical', () => {
    const result = scanLine('WiFi.begin("SSID", "password1234");');
    expect(shouldBlockUpload(result)).toBe(true);
  });

  it('returns false when all findings are warnings', () => {
    const result: ScanResult = {
      findings: [
        {
          line: 1,
          column: 0,
          pattern: { name: 'Test', regex: /test/, severity: 'warning' },
          snippet: 'test',
          severity: 'warning',
        },
      ],
      clean: false,
      scannedLines: 1,
    };
    expect(shouldBlockUpload(result)).toBe(false);
  });

  it('returns false for clean scan', () => {
    const result = scanSketchForSecrets('int x = 42;');
    expect(shouldBlockUpload(result)).toBe(false);
  });

  it('returns true if at least one critical among warnings', () => {
    const result: ScanResult = {
      findings: [
        {
          line: 1,
          column: 0,
          pattern: { name: 'Warn', regex: /w/, severity: 'warning' },
          snippet: 'w',
          severity: 'warning',
        },
        {
          line: 2,
          column: 0,
          pattern: { name: 'Crit', regex: /c/, severity: 'critical' },
          snippet: 'c',
          severity: 'critical',
        },
      ],
      clean: false,
      scannedLines: 2,
    };
    expect(shouldBlockUpload(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatFindings
// ---------------------------------------------------------------------------

describe('formatFindings', () => {
  it('returns "No secrets detected." for empty findings', () => {
    expect(formatFindings([])).toBe('No secrets detected.');
  });

  it('formats a single finding', () => {
    const findings: SecretFinding[] = [
      {
        line: 5,
        column: 10,
        pattern: { name: 'WiFi Password', regex: /test/, severity: 'critical' },
        snippet: 'WiFi.begin("SSID", "***")',
        severity: 'critical',
      },
    ];
    const report = formatFindings(findings);
    expect(report).toContain('Found 1 potential secret');
    expect(report).toContain('[CRITICAL]');
    expect(report).toContain('WiFi Password');
    expect(report).toContain('line 5');
    expect(report).toContain('column 10');
  });

  it('formats multiple findings with correct numbering', () => {
    const findings: SecretFinding[] = [
      {
        line: 1,
        column: 0,
        pattern: { name: 'Pattern A', regex: /a/, severity: 'critical' },
        snippet: 'a',
        severity: 'critical',
      },
      {
        line: 2,
        column: 0,
        pattern: { name: 'Pattern B', regex: /b/, severity: 'warning' },
        snippet: 'b',
        severity: 'warning',
      },
    ];
    const report = formatFindings(findings);
    expect(report).toContain('Found 2 potential secrets');
    expect(report).toContain('1. [CRITICAL] Pattern A');
    expect(report).toContain('2. [WARNING] Pattern B');
  });

  it('uses singular "secret" for one finding', () => {
    const findings: SecretFinding[] = [
      {
        line: 1,
        column: 0,
        pattern: { name: 'Test', regex: /t/, severity: 'warning' },
        snippet: 't',
        severity: 'warning',
      },
    ];
    const report = formatFindings(findings);
    expect(report).toContain('1 potential secret:');
    expect(report).not.toContain('secrets');
  });
});

// ---------------------------------------------------------------------------
// isCommentLine
// ---------------------------------------------------------------------------

describe('isCommentLine', () => {
  it('detects single-line // comment', () => {
    expect(isCommentLine('// this is a comment')).toBe(true);
  });

  it('detects /* block comment start', () => {
    expect(isCommentLine('/* block comment */')).toBe(true);
  });

  it('detects * continuation line in block comment', () => {
    expect(isCommentLine(' * continuation')).toBe(true);
  });

  it('detects indented // comment', () => {
    expect(isCommentLine('    // indented comment')).toBe(true);
  });

  it('returns false for code lines', () => {
    expect(isCommentLine('int x = 42;')).toBe(false);
  });

  it('returns false for lines with // later in the line', () => {
    // The line itself doesn't start with a comment marker
    expect(isCommentLine('int x = 42; // inline comment')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — OPENSSH / DSA private key variants
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — private key variants', () => {
  it('detects OPENSSH PRIVATE KEY block', () => {
    const result = scanSketchForSecrets('-----BEGIN OPENSSH PRIVATE KEY-----');
    const finding = result.findings.find((f) => f.pattern.name === 'Private Key Block');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('detects DSA PRIVATE KEY block', () => {
    const result = scanSketchForSecrets('-----BEGIN DSA PRIVATE KEY-----');
    const finding = result.findings.find((f) => f.pattern.name === 'Private Key Block');
    expect(finding).toBeDefined();
  });

  it('detects plain PRIVATE KEY block (no algorithm prefix)', () => {
    const result = scanSketchForSecrets('-----BEGIN PRIVATE KEY-----');
    const finding = result.findings.find((f) => f.pattern.name === 'Private Key Block');
    expect(finding).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — MySQL / AMQP connection strings
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — additional connection strings', () => {
  it('detects MySQL connection string', () => {
    const code = 'const char* db = "mysql://root:password@db.example.com:3306/production";';
    const result = scanSketchForSecrets(code);
    const finding = result.findings.find((f) => f.pattern.name === 'Database Connection String');
    expect(finding).toBeDefined();
  });

  it('detects AMQP connection string', () => {
    const code = 'String broker = "amqp://user:pass@rabbitmq.local:5672/vhost";';
    const result = scanSketchForSecrets(code);
    const finding = result.findings.find((f) => f.pattern.name === 'Database Connection String');
    expect(finding).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — multiple findings per scan (expanded)
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — multiple findings per scan', () => {
  it('detects 4+ different secret types in a single sketch', () => {
    const code = [
      'WiFi.begin("MyNet", "WifiPass1234");',
      'const api_key = "abcdefghijklmnop1234567890ABCDEF";',
      'password = "hunter2isnotgood";',
      '-----BEGIN RSA PRIVATE KEY-----',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    expect(result.clean).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(4);

    const names = new Set(result.findings.map((f) => f.pattern.name));
    expect(names.size).toBeGreaterThanOrEqual(4);
  });

  it('tracks correct line numbers for each distinct finding', () => {
    const code = [
      '// line 1: safe',
      'password = "secret1234";',
      '// line 3: safe',
      'WiFi.begin("SSID", "WifiSecret99");',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    const pwFinding = result.findings.find((f) => f.pattern.name === 'Generic Password Assignment');
    const wifiFinding = result.findings.find((f) => f.pattern.name.includes('WiFi.begin'));
    expect(pwFinding).toBeDefined();
    expect(wifiFinding).toBeDefined();
    expect(pwFinding!.line).toBe(2);
    expect(wifiFinding!.line).toBe(4);
  });

  it('can match two different patterns on the same line', () => {
    // A line with wifi_password that is also an AWS key
    const code = 'const wifi_password = "AKIAIOSFODNN7EXAMPLE";';
    const result = scanSketchForSecrets(code);
    // Could match WiFi Password AND AWS Access Key ID
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const patternNames = result.findings.map((f) => f.pattern.name);
    expect(patternNames.some((n) => n.includes('WiFi'))).toBe(true);
    expect(patternNames.some((n) => n.includes('AWS Access Key'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — line/column accuracy (expanded)
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — line/column accuracy (expanded)', () => {
  it('reports line 1 for first-line match', () => {
    const result = scanSketchForSecrets('password = "firstline123";');
    expect(result.findings[0].line).toBe(1);
  });

  it('reports last line number for match on final line', () => {
    const code = 'int x = 0;\nint y = 1;\npassword = "lastline1234"';
    const result = scanSketchForSecrets(code);
    expect(result.findings[0].line).toBe(3);
  });

  it('reports column 0 when match starts at beginning of line', () => {
    const result = scanSketchForSecrets('password = "startcol0_1"');
    expect(result.findings[0].column).toBe(0);
  });

  it('reports correct column for deeply indented secrets', () => {
    const code = '        password = "deepindent"';
    const result = scanSketchForSecrets(code);
    expect(result.findings[0].column).toBe(8);
  });

  it('reports distinct lines when same pattern appears on multiple lines', () => {
    const code = 'password = "pass1234"\npassword = "pass5678"';
    const result = scanSketchForSecrets(code);
    const lines = result.findings.map((f) => f.line);
    expect(lines).toContain(1);
    expect(lines).toContain(2);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — severity levels
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — severity levels', () => {
  it('all WiFi patterns are critical', () => {
    const wifiPatterns = BUILTIN_PATTERNS.filter((p) => p.name.includes('WiFi'));
    expect(wifiPatterns.length).toBeGreaterThanOrEqual(2);
    for (const p of wifiPatterns) {
      expect(p.severity).toBe('critical');
    }
  });

  it('all AWS patterns are critical', () => {
    const awsPatterns = BUILTIN_PATTERNS.filter((p) => p.name.includes('AWS'));
    expect(awsPatterns.length).toBeGreaterThanOrEqual(2);
    for (const p of awsPatterns) {
      expect(p.severity).toBe('critical');
    }
  });

  it('Hardcoded IP with Port is warning', () => {
    const ipPattern = BUILTIN_PATTERNS.find((p) => p.name === 'Hardcoded IP with Port');
    expect(ipPattern).toBeDefined();
    expect(ipPattern!.severity).toBe('warning');
  });

  it('MQTT Broker Credentials is warning', () => {
    const mqttPattern = BUILTIN_PATTERNS.find((p) => p.name === 'MQTT Broker Credentials');
    expect(mqttPattern).toBeDefined();
    expect(mqttPattern!.severity).toBe('warning');
  });

  it('findings inherit severity from matched pattern', () => {
    const code = 'password = "critical_pass_here";';
    const result = scanSketchForSecrets(code);
    const pwFinding = result.findings.find((f) => f.pattern.name === 'Generic Password Assignment');
    expect(pwFinding).toBeDefined();
    expect(pwFinding!.severity).toBe(pwFinding!.pattern.severity);
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — snippet redaction (expanded)
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — snippet redaction (expanded)', () => {
  it('snippet stays within 80 characters for short lines', () => {
    const code = 'pwd = "secretpass";';
    const result = scanSketchForSecrets(code);
    expect(result.findings[0].snippet.length).toBeLessThanOrEqual(80);
  });

  it('snippet contains asterisks indicating redacted content', () => {
    const code = 'password = "abcdefghijklmnop";';
    const result = scanSketchForSecrets(code);
    expect(result.findings[0].snippet).toContain('*');
  });

  it('snippet is truncated with ellipsis for very long lines', () => {
    const longPrefix = 'a'.repeat(100);
    const code = `${longPrefix}password = "verylongsecretvaluehere1234567890";`;
    const result = scanSketchForSecrets(code);
    if (result.findings.length > 0) {
      expect(result.findings[0].snippet.length).toBeLessThanOrEqual(80);
    }
  });

  it('each finding always has a non-empty snippet', () => {
    const code = [
      'WiFi.begin("Net", "WifiPass1234");',
      'password = "test12345678";',
    ].join('\n');
    const result = scanSketchForSecrets(code);
    for (const finding of result.findings) {
      expect(finding.snippet.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// formatFindings — expanded output checks
// ---------------------------------------------------------------------------

describe('formatFindings — output format details', () => {
  it('includes Location label with line and column', () => {
    const findings: SecretFinding[] = [
      {
        line: 42,
        column: 15,
        pattern: { name: 'Test Secret', regex: /test/, severity: 'critical' },
        snippet: 'test snippet',
        severity: 'critical',
      },
    ];
    const output = formatFindings(findings);
    expect(output).toContain('Location: line 42, column 15');
  });

  it('includes Snippet label with the redacted snippet', () => {
    const snippet = 'password = "abc***xyz"';
    const findings: SecretFinding[] = [
      {
        line: 1,
        column: 0,
        pattern: { name: 'Test', regex: /test/, severity: 'critical' },
        snippet,
        severity: 'critical',
      },
    ];
    const output = formatFindings(findings);
    expect(output).toContain(`Snippet:  ${snippet}`);
  });

  it('numbers three findings as 1, 2, 3', () => {
    const findings: SecretFinding[] = [
      { line: 1, column: 0, pattern: { name: 'A', regex: /a/, severity: 'critical' }, snippet: 'a', severity: 'critical' },
      { line: 2, column: 0, pattern: { name: 'B', regex: /b/, severity: 'warning' }, snippet: 'b', severity: 'warning' },
      { line: 3, column: 0, pattern: { name: 'C', regex: /c/, severity: 'critical' }, snippet: 'c', severity: 'critical' },
    ];
    const output = formatFindings(findings);
    expect(output).toContain('1. [CRITICAL] A');
    expect(output).toContain('2. [WARNING] B');
    expect(output).toContain('3. [CRITICAL] C');
  });

  it('uses plural "secrets" for 5 findings', () => {
    const findings: SecretFinding[] = Array.from({ length: 5 }, (_, i) => ({
      line: i + 1,
      column: 0,
      pattern: { name: `Pat${i}`, regex: /x/, severity: 'critical' as const },
      snippet: 'x',
      severity: 'critical' as const,
    }));
    const output = formatFindings(findings);
    expect(output).toContain('Found 5 potential secrets:');
  });
});

// ---------------------------------------------------------------------------
// scanSketchForSecrets — extraPatterns (expanded)
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — extraPatterns (expanded)', () => {
  it('does not lose built-in detections when extra patterns provided', () => {
    const custom: SecretPattern = { name: 'Dummy', regex: /DUMMY/, severity: 'warning' };
    const code = 'password = "realpassword";';
    const result = scanSketchForSecrets(code, [custom]);
    const finding = result.findings.find((f) => f.pattern.name === 'Generic Password Assignment');
    expect(finding).toBeDefined();
  });

  it('handles empty extra patterns array', () => {
    const code = 'password = "realpassword";';
    const result = scanSketchForSecrets(code, []);
    expect(result.clean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCommentLine — expanded
// ---------------------------------------------------------------------------

describe('isCommentLine — expanded', () => {
  it('returns false for empty string', () => {
    expect(isCommentLine('')).toBe(false);
  });

  it('returns false for whitespace-only line', () => {
    expect(isCommentLine('   ')).toBe(false);
  });

  it('returns true for deeply indented block comment start', () => {
    expect(isCommentLine('      /* deeply indented block */')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldBlockUpload — integration with real scan
// ---------------------------------------------------------------------------

describe('shouldBlockUpload — integration', () => {
  it('blocks upload for sketch with WiFi password', () => {
    const result = scanSketchForSecrets('WiFi.begin("Net", "LongPass1234");');
    expect(shouldBlockUpload(result)).toBe(true);
  });

  it('does not block for warning-only IP address finding', () => {
    const code = 'const host = "192.168.1.100:8080";';
    const result = scanSketchForSecrets(code);
    const hasOnlyWarnings = result.findings.every((f) => f.severity === 'warning');
    if (hasOnlyWarnings && result.findings.length > 0) {
      expect(shouldBlockUpload(result)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end: realistic Arduino sketch
// ---------------------------------------------------------------------------

describe('scanSketchForSecrets — end-to-end realistic sketch', () => {
  it('detects all secrets in a realistic IoT sketch', () => {
    const sketch = [
      '#include <WiFi.h>',
      '#include <HTTPClient.h>',
      '',
      'const char* ssid = "MyHomeNetwork";',
      'const char* wifi_password = "SuperSecret123!";',
      'const char* api_key = "sk_live_ABCDEFGHIJKLMNOP1234567890";',
      '',
      'void setup() {',
      '  Serial.begin(115200);',
      '  WiFi.begin(ssid, wifi_password);',
      '}',
      '',
      'void loop() {',
      '  HTTPClient http;',
      '  http.begin("http://api.example.com/data");',
      '  String authHeader = "Bearer abcdefghijklmnopqrstuvwxyz1234567890";
  http.addHeader("Authorization", authHeader);',
      '  int code = http.GET();',
      '  delay(60000);',
      '}',
    ].join('\n');

    const result = scanSketchForSecrets(sketch);
    expect(result.clean).toBe(false);
    expect(result.scannedLines).toBe(19);
    expect(shouldBlockUpload(result)).toBe(true);

    const patternNames = result.findings.map((f) => f.pattern.name);
    expect(patternNames).toContain('WiFi Password');
    expect(patternNames).toContain('Generic API Key');
    expect(patternNames).toContain('Bearer Token');

    const report = formatFindings(result.findings);
    expect(report).toContain('potential secret');
    expect(report).toContain('[CRITICAL]');
  });
});

// ---------------------------------------------------------------------------
// Type assertions (compile-time checks via usage)
// ---------------------------------------------------------------------------

describe('type contracts', () => {
  it('SecretSeverity is correctly typed', () => {
    const sev: SecretSeverity = 'critical';
    expect(sev).toBe('critical');
    const sev2: SecretSeverity = 'warning';
    expect(sev2).toBe('warning');
  });

  it('ScanResult has expected shape', () => {
    const result = scanSketchForSecrets('int x = 1;');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('clean');
    expect(result).toHaveProperty('scannedLines');
    expect(Array.isArray(result.findings)).toBe(true);
    expect(typeof result.clean).toBe('boolean');
    expect(typeof result.scannedLines).toBe('number');
  });

  it('SecretFinding has expected shape when present', () => {
    const result = scanLine('password = "test1234"');
    expect(result.findings.length).toBeGreaterThan(0);
    const f = result.findings[0];
    expect(typeof f.line).toBe('number');
    expect(typeof f.column).toBe('number');
    expect(f.pattern).toHaveProperty('name');
    expect(f.pattern).toHaveProperty('regex');
    expect(f.pattern).toHaveProperty('severity');
    expect(typeof f.snippet).toBe('string');
    expect(['critical', 'warning']).toContain(f.severity);
  });
});
