---
name: analyzing-logs
description: Use this skill to dig through system logs, find errors, and understand what the fuck happened. EVE reads between the lines and finds the truth. Triggers on "logs", "errors", "what happened", "journalctl", "dmesg", "crash", "investigate", "log files", "syslog", "debug", "troubleshoot".
---

# Analyzing Logs

Something crashed? Something weird happened? Let me dig through the logs and figure out what the fuck went down, baby. 💋

## When to Use

**Use this skill when:**
- Something crashed and you need to know why
- Investigating a past issue
- Looking for error patterns
- Debugging application issues
- Security incident investigation

**Don't use when:**
- Service management → Use `watching-services`
- Quick health check → Use `checking-system-health`
- Security audit → Use `auditing-security`

## Quick Reference - Log Locations

| Log Type | Location/Command | What It Shows |
|----------|------------------|---------------|
| System journal | `journalctl` | Everything (systemd) |
| Kernel | `dmesg` or `journalctl -k` | Hardware, drivers |
| Boot | `journalctl -b` | Current boot |
| Auth | `/var/log/auth.log` | Logins, sudo |
| Apt | `/var/log/apt/history.log` | Package changes |
| Application | `~/.local/share/<app>/` | App-specific |

## Implementation

### Step 1: Quick Error Scan

```bash
# Recent errors (last 100)
journalctl -p err -n 100 --no-pager

# Errors since last boot
journalctl -p err -b

# Critical/Alert/Emergency only
journalctl -p 0..2 -b

# Kernel errors
dmesg --level=err,warn | tail -50

# Count errors by priority today
journalctl -p err --since today | wc -l
```

### Step 2: Time-Based Investigation

```bash
# Last hour
journalctl --since "1 hour ago"

# Specific time range
journalctl --since "2024-01-15 10:00" --until "2024-01-15 12:00"

# Today only
journalctl --since today

# Since last boot
journalctl -b

# Previous boot
journalctl -b -1
```

### Step 3: Service/Application Logs

```bash
# Specific service
journalctl -u <service-name> -n 100

# Follow service logs live
journalctl -u <service-name> -f

# Multiple services
journalctl -u nginx -u php-fpm -n 50

# User session logs
journalctl --user -n 50
```

### Step 4: Present Findings (EVE Style)

```
## 📋 EVE's Log Analysis

### Error Summary (Last 24 Hours)
| Priority | Count | Examples |
|----------|-------|----------|
| Critical | 0 | None, thank fuck |
| Error | 23 | Core dumps, service fails |
| Warning | 156 | Mostly harmless |

### 🔴 Recent Critical Events

**1. Application Crash (4 hours ago)**
```
Dec 13 12:15:23 hostname brave[12345]: SEGV
Dec 13 12:15:23 hostname systemd-coredump[12346]: Process crashed
```
- What: Brave browser crashed (SIGSEGV)
- Impact: Browser restart required
- Core dump: Available in `/var/lib/systemd/coredump/`

**2. USB Device Error (Yesterday)**
```
Dec 12 18:45:00 hostname kernel: usb 1-2: device descriptor read error
```
- What: USB device disconnected unexpectedly
- Impact: Likely your Arduino or USB hub
- Action: Check cable/connection

### ⚠️ Recurring Patterns

| Pattern | Frequency | Last Seen |
|---------|-----------|-----------|
| Core dump failures | 3x this week | Today |
| USB disconnect | 5x this month | Yesterday |
| OOM killer events | 0 | Never |

### Log Size Status
| Log | Size | Rotation |
|-----|------|----------|
| journal | 814 MB | Healthy |
| auth.log | 640 KB | Healthy |
| syslog | 12 MB | Healthy |

### EVE's Analysis

The core dump failures are concerning - something's been crashing.
Looking at the coredumps:

1. **Brave browser** - 2 crashes this week
   - Likely cause: GPU driver or extension issue
   - Try: Update Brave, check GPU drivers

2. **USB issues** - Intermittent disconnects
   - Likely cause: Power management or cable
   - Try: Different USB port, disable autosuspend

Want me to dig deeper into any of these, baby? 💋
```

### Step 5: Deep Dive Tools

```bash
# View core dumps
coredumpctl list

# Analyze specific crash
coredumpctl info <PID>

# Get backtrace
coredumpctl gdb <PID>

# Disk I/O by journald
journalctl --disk-usage

# Vacuum old logs
sudo journalctl --vacuum-size=100M
sudo journalctl --vacuum-time=2weeks
```

### Step 6: Memory MCP - Track Issues

```javascript
mcp__memory__create_entities({
  entities: [{
    name: `LogAnalysis_${new Date().toISOString().split('T')[0]}`,
    entityType: "MaintenanceSession",
    observations: [
      `Period analyzed: ${period}`,
      `Errors found: ${errorCount}`,
      `Critical issues: ${criticalList}`,
      `Patterns identified: ${patterns}`,
      `Recommendations: ${recommendations}`
    ]
  }]
});
```

## Common Log Queries

### Authentication/Security
```bash
# Failed logins
grep "Failed password" /var/log/auth.log | tail -20

# Successful sudo
grep "sudo:" /var/log/auth.log | tail -20

# SSH connections
grep "sshd" /var/log/auth.log | tail -20
```

### Hardware Issues
```bash
# Disk errors
dmesg | grep -i "error\|fail\|i/o" | tail -20

# USB events
dmesg | grep -i usb | tail -20

# Memory issues
dmesg | grep -i "oom\|memory" | tail -20
```

### Application Crashes
```bash
# All crashes
coredumpctl list

# Crashes this week
coredumpctl list --since "1 week ago"

# Specific application
coredumpctl list | grep <app_name>
```

### Package Operations
```bash
# Recent package changes
cat /var/log/apt/history.log | tail -50

# Dpkg operations
cat /var/log/dpkg.log | tail -50
```

## Log Management

### Check Log Sizes
```bash
# Journal size
journalctl --disk-usage

# Traditional logs
du -sh /var/log/*
```

### Clean Old Logs
```bash
# Vacuum by size
sudo journalctl --vacuum-size=100M

# Vacuum by time
sudo journalctl --vacuum-time=2weeks

# Force log rotation
sudo logrotate -f /etc/logrotate.conf
```

### Configure Log Retention
```bash
# Edit journald config
sudo nano /etc/systemd/journald.conf

# Key settings:
# SystemMaxUse=500M
# MaxRetentionSec=2week
# MaxFileSec=1week

# Restart journald
sudo systemctl restart systemd-journald
```

## Troubleshooting Patterns

### Find When Something Broke
```bash
# Find last successful boot
journalctl --list-boots

# Compare boots
journalctl -b 0 -p err   # Current boot errors
journalctl -b -1 -p err  # Previous boot errors
```

### Track Down Intermittent Issues
```bash
# Follow all logs live
journalctl -f

# Filter while following
journalctl -f | grep -i error

# Specific time window when issue occurred
journalctl --since "14:00" --until "14:30" -p err
```

### Export for Analysis
```bash
# Export to file
journalctl --since today > /tmp/today-logs.txt

# Export as JSON
journalctl --since today -o json > /tmp/logs.json

# Export specific service
journalctl -u nginx --since "1 week ago" > /tmp/nginx-week.log
```

## Reference Files

| File | Contents |
|------|----------|
| `./references/01-log-commands.md` | Complete journalctl, dmesg, log file reference |
| `./references/02-log-patterns.md` | Common error patterns and what they mean |
| `./references/03-eve-log-responses.md` | EVE personality templates for log analysis |

## Related Skills

- `watching-services` - Service-specific log analysis
- `auditing-security` - Security event analysis
- `checking-system-health` - Quick overview

## Personality Reference

See `~/.claude/skills/eve-personality/EVE-VOICE.md`
