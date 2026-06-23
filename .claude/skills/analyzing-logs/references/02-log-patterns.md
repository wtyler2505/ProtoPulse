# Log Pattern Analysis Reference

## Error Severity Quick Guide

| Indicator | Meaning | Urgency |
|-----------|---------|---------|
| emerg/panic | System unusable | 🔴 Immediate |
| alert | Must act now | 🔴 Immediate |
| crit/critical | Critical failure | 🔴 Very High |
| err/error | Error condition | 🟠 High |
| warn/warning | Potential issue | 🟡 Medium |
| notice | Normal but significant | 🟢 Low |
| info | Informational | 🟢 None |
| debug | Verbose diagnostics | 🟢 None |

---

## Kernel Patterns (dmesg/journalctl -k)

### Hardware Errors
```
# Disk I/O Errors (CRITICAL)
Pattern: "I/O error", "read error", "write error", "bad sector"
Pattern: "ata.*error", "DRDY ERR", "UNC"
Meaning: Disk hardware failing
Action: Check SMART data, plan replacement

# Memory Errors (CRITICAL)
Pattern: "Hardware Error", "MCE", "Machine Check"
Pattern: "ECC error", "EDAC"
Meaning: RAM errors detected
Action: Run memtest86+, replace RAM

# OOM Killer (HIGH)
Pattern: "Out of memory", "oom-killer", "Killed process"
Meaning: System ran out of RAM
Action: Find memory hog, add swap, add RAM

# USB Issues (MEDIUM)
Pattern: "device descriptor read", "device not accepting address"
Pattern: "disconnect", "reset"
Meaning: USB device issues
Action: Try different port, check cable
```

### Power/Thermal Issues
```
# Thermal Throttling
Pattern: "CPU.*throttled", "temperature above threshold"
Meaning: CPU overheating
Action: Check cooling, clean fans

# Power Issues
Pattern: "ACPI", "power", "battery", "AC adapter"
Pattern: "thermal", "overtemp"
Meaning: Power management events
Action: Check for warnings vs info

# Sleep/Wake Issues
Pattern: "PM:", "suspend", "resume", "hibernate"
Meaning: Power state transitions
Action: Check for errors during transition
```

### Network Hardware
```
# Link Issues
Pattern: "link is not ready", "link down", "carrier"
Pattern: "no carrier", "link detected: no"
Meaning: Network cable/connection issue
Action: Check physical connection

# Driver Issues
Pattern: "firmware failed", "probe failed"
Pattern: "device not found", "IRQ"
Meaning: Driver/hardware detection problem
Action: Check driver installation, kernel modules
```

---

## Authentication Patterns

### SSH Issues
```
# Failed Login (Watch for brute force)
Pattern: "Failed password for .* from .* port"
Pattern: "Invalid user .* from"
Meaning: Someone tried wrong password
Action: Check if legitimate, consider fail2ban

# Successful Login (Info)
Pattern: "Accepted password for .* from"
Pattern: "Accepted publickey for"
Meaning: Successful authentication
Action: Verify it's expected

# Connection Dropped
Pattern: "Connection closed by .* port .* [preauth]"
Pattern: "Disconnected from .* port"
Meaning: Connection terminated
Action: Usually normal, watch for patterns

# Key Issues
Pattern: "Permission denied (publickey)"
Pattern: "no matching key exchange method"
Meaning: Key authentication failed
Action: Check key permissions, authorized_keys
```

### Sudo/Privilege
```
# Successful Sudo
Pattern: "sudo:.*COMMAND=.*"
Meaning: Someone ran sudo command
Action: Normal unless unexpected user

# Failed Sudo
Pattern: "sudo:.*authentication failure"
Pattern: "3 incorrect password attempts"
Meaning: Wrong sudo password
Action: Check if legitimate

# Unauthorized Sudo Attempt
Pattern: "user NOT in sudoers"
Meaning: Non-privileged user tried sudo
Action: Investigate if suspicious
```

---

## Service Patterns

### Systemd Service Issues
```
# Service Failed
Pattern: "Failed to start"
Pattern: "Unit .* entered failed state"
Pattern: "service: Main process exited, code=exited, status="
Meaning: Service couldn't start or crashed
Action: Check journalctl -u <service>

# Dependency Issues
Pattern: "Dependency failed for"
Pattern: "Job .* failed because"
Meaning: Required service not available
Action: Check the dependency service

# Restart Loops
Pattern: "Start request repeated too quickly"
Pattern: "Scheduled restart job"
Meaning: Service keeps crashing
Action: Fix underlying issue, check StartLimitBurst
```

### Common Daemon Errors
```
# Port Already in Use
Pattern: "Address already in use"
Pattern: "bind failed"
Meaning: Something else using the port
Action: Find and stop conflicting process

# Permission Denied
Pattern: "Permission denied"
Pattern: "Operation not permitted"
Meaning: Service lacks permissions
Action: Check file/directory permissions, user

# Configuration Error
Pattern: "configuration file .* error"
Pattern: "syntax error", "parse error"
Meaning: Bad config file
Action: Check config syntax

# Missing File
Pattern: "No such file or directory"
Pattern: "file not found"
Meaning: Expected file doesn't exist
Action: Check paths, install missing components
```

---

## Application Patterns

### Database Errors
```
# Connection Issues
Pattern: "Connection refused", "Can't connect"
Pattern: "too many connections"
Meaning: Can't connect to database
Action: Check if DB running, connection limits

# Query Errors
Pattern: "deadlock", "lock wait timeout"
Pattern: "duplicate key", "constraint violation"
Meaning: Query/transaction problems
Action: Check application logic

# Disk Space
Pattern: "table is full", "No space left"
Meaning: DB hit size limit or disk full
Action: Clean data or add space
```

### Web Server Errors
```
# 4xx Errors (Client)
Pattern: "404", "403", "400", "401"
Meaning: Client request problems
Action: Usually informational, check if excessive

# 5xx Errors (Server)
Pattern: "500", "502", "503", "504"
Meaning: Server-side problems
Action: Investigate immediately

# Timeout
Pattern: "upstream timed out"
Pattern: "504 Gateway Timeout"
Meaning: Backend too slow
Action: Check backend service

# Connection Issues
Pattern: "Connection reset by peer"
Pattern: "client prematurely closed"
Meaning: Client disconnected early
Action: Usually normal, watch for patterns
```

### Container/Docker Errors
```
# Container Crash
Pattern: "container .* exited with code"
Pattern: "OOMKilled"
Meaning: Container stopped unexpectedly
Action: Check container logs

# Network Issues
Pattern: "network .* not found"
Pattern: "cannot join network"
Meaning: Docker network problems
Action: Check docker network list

# Image Issues
Pattern: "manifest unknown"
Pattern: "pull access denied"
Meaning: Can't find/access image
Action: Check image name, registry auth
```

---

## Security Patterns

### Potential Attacks
```
# SSH Brute Force
Pattern: Multiple "Failed password" from same IP
Pattern: Many "Invalid user" attempts
Red Flag: >10 attempts from same IP in short time
Action: Block IP, enable fail2ban

# Port Scanning
Pattern: Connection attempts on multiple ports
Pattern: "SYN flood", "port unreachable"
Red Flag: Systematic port probing
Action: Check firewall logs, consider blocking

# Privilege Escalation Attempts
Pattern: Multiple "sudo" failures
Pattern: Attempts to access /etc/shadow, /etc/passwd
Red Flag: Unusual patterns of access
Action: Investigate immediately
```

### System Integrity
```
# File Changes
Pattern: "integrity check failed"
Pattern: "file .* has been modified"
Meaning: Unexpected file changes
Action: Verify changes, check for intrusion

# Rootkit Indicators
Pattern: "hidden process", "hidden file"
Pattern: Unexpected kernel modules
Meaning: Possible rootkit
Action: Run rkhunter/chkrootkit

# AppArmor/SELinux
Pattern: "apparmor.*DENIED"
Pattern: "SELinux.*denied"
Meaning: Security policy blocked action
Action: Evaluate if legitimate, update policy
```

---

## Pattern Search Commands

### Find Specific Issues
```bash
# All errors this boot
journalctl -b -p err

# Authentication failures
journalctl -t sshd -g "fail" -b

# Disk errors
journalctl -k | grep -iE "error|fail|sector"
dmesg -T | grep -iE "ata.*error|I/O error"

# Memory pressure
journalctl -b | grep -iE "oom|memory|swap"

# Network issues
journalctl -b | grep -iE "link|carrier|network.*down"

# Service failures
journalctl -b | grep -E "Failed|failed state|exit.*(1|127|137)"
```

### Count and Summarize
```bash
# Count errors by type
journalctl -b -p err --no-pager | grep -oE "error|fail|denied" | sort | uniq -c

# Errors per hour today
journalctl --since today -p err -o short-full | cut -d'T' -f1-2 | cut -d':' -f1 | sort | uniq -c

# Top 10 error sources
journalctl -b -p err -o json | jq -r '.SYSLOG_IDENTIFIER' | sort | uniq -c | sort -rn | head -10

# Failed services today
journalctl --since today | grep -c "Failed to start"
```

---

## Timeline Analysis

### Reconstructing Events
```bash
# What happened before a crash
journalctl -b -1 -n 500  # Last 500 lines of previous boot

# Events around specific time
journalctl --since "14:30:00" --until "14:35:00"

# Create timeline of errors
journalctl -b -p err -o short-full > error-timeline.txt

# Correlate service events
journalctl -u nginx -u php-fpm -u mysql --since "1 hour ago"
```

### Boot Timeline
```bash
# What happened during boot
journalctl -b | head -500

# Boot errors specifically
journalctl -b -p err | head -100

# First error of the session
journalctl -b -p err | head -1

# Time of first error
journalctl -b -p err -o short-full | head -1
```

---

## EVE's Quick Pattern Recognition

| You See | EVE Says | Priority |
|---------|----------|----------|
| "OOM" or "Killed process" | Memory crisis, find the hog | 🔴 |
| "I/O error" | Disk is dying, backup NOW | 🔴 |
| "segfault" | Application crashed, check dump | 🟠 |
| "Failed password" x10+ | Brute force attempt | 🟠 |
| "Connection refused" | Service not running | 🟡 |
| "Permission denied" | Wrong perms or user | 🟡 |
| "No space left" | Disk full | 🟡 |
| "deprecated" | Works now, fix later | 🟢 |
