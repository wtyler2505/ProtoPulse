---
description: Deep security analysis using gitleaks, npm audit, and pattern-based vulnerability detection
allowed-tools: Bash, Read, Grep, Glob, mcp__desktop-commander__*
category: validation
---
# Security Audit - Vulnerability & Secrets Detection
**Description**: Deep security analysis using gitleaks (snyk optional, if installed), npm audit, and pattern-based vulnerability detection.

## SEVERITY LEVELS
| Level | Response Time | Examples |
|-------|---------------|----------|
| CRITICAL | Immediate | Exposed secrets, RCE vulnerabilities |
| HIGH | 24 hours | SQL injection, XSS, auth bypass |
| MEDIUM | 1 week | CSRF, info disclosure, weak crypto |
| LOW | 1 month | Best practice violations |

## PHASE 1: SECRETS DETECTION

### 1.1 Gitleaks Scan
```bash
gitleaks detect --source $ARGUMENTS --verbose --report-format json --report-path ${AUDIT_DIR}/reports/gitleaks.json 2>&1
gitleaks detect --source $ARGUMENTS --verbose > ${AUDIT_DIR}/reports/gitleaks.txt 2>&1
```
**ANY FINDING = CRITICAL**. Document immediately:
```markdown
### CRITICAL: Exposed Secret
**File**: [path]
**Line**: [line number]
**Type**: [API key, password, token, etc.]
**Action**: ROTATE IMMEDIATELY, then remove from code
```

### 1.2 Git History Secrets
```bash
gitleaks detect --source $ARGUMENTS --log-opts="--all" > ${AUDIT_DIR}/reports/gitleaks-history.txt 2>&1
```
Secrets in git history are STILL exposed even if removed from current code.

### 1.3 Environment File Check
mcp__desktop-commander__read_file path=".env"
mcp__desktop-commander__read_file path=".env.local"
mcp__desktop-commander__read_file path=".env.production"

Check:
- [ ] .env files in .gitignore?
- [ ] .env.example exists (without real values)?
- [ ] No production secrets in repo?

### 1.4 Common Secret Patterns
```bash
# Hardcoded credentials
rg -i "password\s*[=:]\s*['\"][^'\"]+['\"]" $ARGUMENTS
rg -i "secret\s*[=:]\s*['\"][^'\"]+['\"]" $ARGUMENTS
rg -i "api_?key\s*[=:]\s*['\"][^'\"]+['\"]" $ARGUMENTS
rg -i "token\s*[=:]\s*['\"][^'\"]+['\"]" $ARGUMENTS

# AWS credentials
rg "AKIA[0-9A-Z]{16}" $ARGUMENTS
rg "aws_secret_access_key" $ARGUMENTS

# Private keys
rg "BEGIN RSA PRIVATE KEY" $ARGUMENTS
rg "BEGIN OPENSSH PRIVATE KEY" $ARGUMENTS
```

## PHASE 2: DEPENDENCY VULNERABILITIES

### 2.1 NPM Audit
```bash
npm audit --json > ${AUDIT_DIR}/reports/npm-audit.json 2>&1
npm audit > ${AUDIT_DIR}/reports/npm-audit.txt 2>&1
```

### 2.2 Snyk (if available)
```bash
command -v snyk >/dev/null && snyk test --json > ${AUDIT_DIR}/reports/snyk.json 2>&1 || true
command -v snyk >/dev/null && snyk test > ${AUDIT_DIR}/reports/snyk.txt 2>&1 || true
```

### 2.3 Python Safety (if applicable)
```bash
safety check --json > ${AUDIT_DIR}/reports/safety.json 2>&1 || true
pip-audit --format json > ${AUDIT_DIR}/reports/pip-audit.json 2>&1 || true
```

### 2.4 Document Each Vulnerability
```markdown
### Vulnerability: [CVE-XXXX-XXXXX]
**Package**: [name]@[version]
**Severity**: Critical/High/Medium/Low
**Description**: [what it allows]
**Fix**: Upgrade to [version] or higher
**Status**: Open / FIXED
```

## PHASE 3: CODE VULNERABILITY PATTERNS

### 3.1 Injection Vulnerabilities
```bash
# SQL Injection
ast-grep --pattern 'query($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'exec($$$)' --lang typescript $ARGUMENTS
rg "SELECT.*\+.*\$" $ARGUMENTS  # String concatenation in SQL

# Command Injection
ast-grep --pattern 'exec($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'spawn($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'execSync($$$)' --lang typescript $ARGUMENTS

# eval() usage
ast-grep --pattern 'eval($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'Function($$$)' --lang typescript $ARGUMENTS
```

### 3.2 XSS Vulnerabilities
```bash
# Dangerous HTML insertion
ast-grep --pattern 'innerHTML' --lang typescript $ARGUMENTS
ast-grep --pattern 'outerHTML' --lang typescript $ARGUMENTS
ast-grep --pattern 'dangerouslySetInnerHTML' --lang typescript $ARGUMENTS
ast-grep --pattern 'document.write($$$)' --lang typescript $ARGUMENTS

# Unescaped user input in templates
rg "\\$\\{.*\\}" --type html $ARGUMENTS
```

### 3.3 Authentication Issues
```bash
# Weak password handling
rg -i "md5|sha1" $ARGUMENTS  # Weak hashing
rg -i "base64" $ARGUMENTS    # Not encryption!

# Session issues
ast-grep --pattern 'localStorage.setItem' --lang typescript $ARGUMENTS
ast-grep --pattern 'sessionStorage' --lang typescript $ARGUMENTS
```

### 3.4 CSRF/CORS Issues
```bash
# CORS configuration
rg "Access-Control-Allow-Origin" $ARGUMENTS
rg "cors\\(" $ARGUMENTS

# Missing CSRF tokens
rg -i "csrf" $ARGUMENTS
```

### 3.5 Path Traversal
```bash
# Unsafe file operations
ast-grep --pattern 'readFile($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'readFileSync($$$)' --lang typescript $ARGUMENTS
rg "\\.\\./\\.\\./" $ARGUMENTS  # Directory traversal patterns
```

## PHASE 4: CONFIGURATION SECURITY

### 4.1 Sensitive Headers
Check for security headers in server config:
- [ ] Content-Security-Policy
- [ ] X-Content-Type-Options
- [ ] X-Frame-Options
- [ ] Strict-Transport-Security
- [ ] X-XSS-Protection

### 4.2 HTTPS Enforcement
```bash
rg "http://" $ARGUMENTS --type ts --type js | grep -v "localhost\|127.0.0.1"
```

### 4.3 Debug Mode
```bash
rg -i "debug\s*[=:]\s*true" $ARGUMENTS
rg "NODE_ENV.*development" $ARGUMENTS
```

## PHASE 5: BROWSER SECURITY CHECK (Claude in Chrome)
If app is web-based:
mcp__claude-in-chrome__navigate url="$ARGUMENTS"
mcp__claude-in-chrome__read_console_messages pattern="security|warning|error"
mcp__claude-in-chrome__read_network_requests  # Check for HTTP (not HTTPS)

Check browser console for:
- Mixed content warnings
- CORS errors
- CSP violations
- Cookie security warnings

## AUTO-FIX RULES

### AUTO-FIX (Safe):
- Add .env to .gitignore
- Remove console.log with sensitive data
- Update minor dependency versions

### NEVER AUTO-FIX (Always ask):
- Anything involving credentials
- Authentication/authorization code
- Encryption/hashing changes
- CORS configuration
- Security header changes

## SUMMARY TEMPLATE
```markdown
# Security Audit Summary

## Risk Assessment
| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Secrets | X | - | - | - |
| Dependencies | X | X | X | X |
| Code Patterns | X | X | X | X |
| Configuration | X | X | X | X |
| **TOTAL** | **X** | **X** | **X** | **X** |

## Immediate Actions Required
 [Most critical - usually secrets]
 [High priority items]
 [High priority items]

## Dependency Vulnerabilities
- Critical: X packages
- High: X packages
- Action: Run `npm audit fix` or manual upgrades

## Secrets Status
- [ ] No secrets in code
- [ ] No secrets in git history
- [ ] .env files properly gitignored
- [ ] All API keys rotated (if exposed)

## Recommendations
1. [Top recommendation]
2. [Second recommendation]
3. [Third recommendation]
```

## TARGET $ARGUMENTS
Default: Current working directory
