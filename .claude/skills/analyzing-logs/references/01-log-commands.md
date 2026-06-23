# Log Analysis Command Reference

## Quick Reference Table

| Task | Command | Description |
|------|---------|-------------|
| All logs | `journalctl` | Full system journal |
| Recent logs | `journalctl -e` | Jump to end |
| Follow live | `journalctl -f` | Tail the logs |
| Service logs | `journalctl -u <service>` | Specific service |
| Boot logs | `journalctl -b` | Current boot only |
| Kernel logs | `dmesg` or `journalctl -k` | Kernel messages |
| Auth logs | `journalctl -t sshd` | SSH/auth logs |
| Priority filter | `journalctl -p err` | Errors and above |
| Time filter | `journalctl --since "1h ago"` | Last hour |
| Search | `journalctl -g "pattern"` | Grep in logs |

---

## journalctl Commands

### Basic Viewing
```bash
# All logs (oldest first)
journalctl

# All logs (newest first, jump to end)
journalctl -e

# Follow in real-time
journalctl -f

# Show last N lines
journalctl -n 100

# Reverse order (newest first)
journalctl -r

# No pager (for piping)
journalctl --no-pager
```

### Time-Based Filtering
```bash
# Current boot only
journalctl -b

# Previous boot
journalctl -b -1

# Two boots ago
journalctl -b -2

# List all boots
journalctl --list-boots

# Since specific time
journalctl --since "2024-01-15 09:00:00"
journalctl --since "1 hour ago"
journalctl --since yesterday
journalctl --since "2024-01-15" --until "2024-01-16"

# Last X time
journalctl --since "30 min ago"
journalctl --since "2 days ago"
```

### Service and Unit Filtering
```bash
# Specific service
journalctl -u nginx.service

# Multiple services
journalctl -u nginx -u php-fpm

# User services
journalctl --user -u <service>

# Specific identifier (syslog tag)
journalctl -t kernel
journalctl -t sudo
journalctl -t sshd

# Specific unit pattern
journalctl -u "docker*"
```

### Priority Filtering
```bash
# Priority levels (0-7):
# 0: emerg   - System is unusable
# 1: alert   - Action must be taken immediately
# 2: crit    - Critical conditions
# 3: err     - Error conditions
# 4: warning - Warning conditions
# 5: notice  - Normal but significant
# 6: info    - Informational
# 7: debug   - Debug messages

# Show errors and above (0-3)
journalctl -p err

# Show warnings and above (0-4)
journalctl -p warning

# Range of priorities
journalctl -p warning..err

# Just critical
journalctl -p crit

# Errors only this boot
journalctl -p err -b
```

### Search and Grep
```bash
# Search for pattern (regex)
journalctl -g "error|fail"

# Case-insensitive search
journalctl -g "(?i)error"

# Combine with other filters
journalctl -u ssh -g "Failed password" -b

# Pipe to grep for more control
journalctl -b | grep -i "error" | head -50

# Count occurrences
journalctl -b | grep -c "error"
```

### Output Formats
```bash
# Short (default)
journalctl -o short

# Short with full timestamp
journalctl -o short-full

# JSON output
journalctl -o json

# JSON pretty
journalctl -o json-pretty

# Verbose (all metadata)
journalctl -o verbose

# Just the message
journalctl -o cat

# Export format (for backup)
journalctl -o export > journal-backup.log
```

### Kernel and Boot Logs
```bash
# Kernel messages only
journalctl -k
journalctl --dmesg

# Kernel messages this boot
journalctl -k -b

# Kernel errors
journalctl -k -p err

# Boot process
journalctl -b | head -200
```

---

## dmesg Commands

### Basic Usage
```bash
# All kernel messages
dmesg

# Human-readable timestamps
dmesg -T
dmesg --ctime

# Follow in real-time
dmesg -w
dmesg --follow

# Clear ring buffer (root only)
sudo dmesg -c
```

### Filtering
```bash
# By facility
dmesg --facility=kern
dmesg --facility=user
dmesg --facility=daemon

# By level
dmesg --level=err
dmesg --level=warn,err

# Grep patterns
dmesg | grep -i usb
dmesg | grep -i error
dmesg | grep -i "ata\|sda\|nvme"
```

### Common dmesg Searches
```bash
# Hardware detection
dmesg | grep -i "usb\|pci\|acpi"

# Disk activity
dmesg | grep -i "sd\|nvme\|ata"

# Network
dmesg | grep -i "eth\|wlan\|wifi\|network"

# Memory issues
dmesg | grep -i "oom\|memory\|swap"

# Errors
dmesg | grep -i "error\|fail\|warn"

# CPU
dmesg | grep -i "cpu\|microcode"
```

---

## Log File Locations

### Traditional Log Files
```
/var/log/syslog          # General system log (Debian/Ubuntu)
/var/log/messages        # General system log (RHEL/CentOS)
/var/log/auth.log        # Authentication logs
/var/log/secure          # Auth logs (RHEL)
/var/log/kern.log        # Kernel logs
/var/log/dmesg           # Boot-time dmesg snapshot
/var/log/boot.log        # Boot messages
/var/log/faillog         # Failed login attempts
/var/log/lastlog         # Last login info
/var/log/wtmp            # Login records (binary - use 'last')
/var/log/btmp            # Failed logins (binary - use 'lastb')
```

### Application Logs
```
/var/log/apache2/        # Apache web server
/var/log/nginx/          # Nginx web server
/var/log/mysql/          # MySQL database
/var/log/postgresql/     # PostgreSQL database
/var/log/cups/           # Printing system
/var/log/apt/            # Package manager
/var/log/dpkg.log        # Package installations
/var/log/alternatives.log # Update-alternatives log
```

### User Logs
```
~/.xsession-errors       # X11 session errors
~/.local/share/xorg/     # Xorg logs
~/.config/*/             # App-specific logs
```

### Viewing Traditional Logs
```bash
# View with less
less /var/log/syslog

# Tail last 50 lines
tail -50 /var/log/syslog

# Follow in real-time
tail -f /var/log/syslog

# Search in log file
grep "error" /var/log/syslog

# Search with context
grep -C 5 "error" /var/log/syslog

# Last logins
last
last -20

# Failed logins (needs root)
sudo lastb
```

---

## Log Rotation

### Understanding Rotation
```bash
# Rotated logs have numbers or dates
/var/log/syslog      # Current
/var/log/syslog.1    # Yesterday (or last rotation)
/var/log/syslog.2.gz # Older, compressed
/var/log/syslog.3.gz # Even older

# View compressed logs
zcat /var/log/syslog.2.gz
zless /var/log/syslog.2.gz
zgrep "error" /var/log/syslog.*.gz
```

### Logrotate Configuration
```bash
# Main config
cat /etc/logrotate.conf

# Per-app configs
ls /etc/logrotate.d/

# Force rotation (for testing)
sudo logrotate -f /etc/logrotate.conf

# Dry run
sudo logrotate -d /etc/logrotate.conf
```

### Journal Size Management
```bash
# Check journal disk usage
journalctl --disk-usage

# Vacuum old logs (keep last 2 weeks)
sudo journalctl --vacuum-time=2weeks

# Vacuum to specific size
sudo journalctl --vacuum-size=500M

# Configure max size
# Edit /etc/systemd/journald.conf
# SystemMaxUse=500M
# SystemKeepFree=1G
```

---

## Advanced Analysis

### Aggregated Searches
```bash
# Errors across all services this boot
journalctl -b -p err --no-pager

# All authentication events
journalctl _COMM=sudo
journalctl _COMM=sshd
journalctl _COMM=login

# By executable
journalctl /usr/sbin/sshd

# By user ID
journalctl _UID=1000

# By PID
journalctl _PID=1234
```

### Statistical Analysis
```bash
# Count errors by service
journalctl -b -p err -o json | jq '.SYSLOG_IDENTIFIER' | sort | uniq -c | sort -rn

# Errors per hour
journalctl -b -p err --output=short-full | cut -d' ' -f1-2 | cut -d':' -f1 | sort | uniq -c

# Most active units
journalctl -b -o json | jq '._SYSTEMD_UNIT' | sort | uniq -c | sort -rn | head -20
```

### Correlation
```bash
# Events around a specific time
journalctl --since "14:30:00" --until "14:35:00"

# Events before a crash
journalctl -b -1 -e  # End of previous boot

# Follow multiple sources
journalctl -f -u nginx -u php-fpm -u mysql
```

---

## Quick Copy Reference

```bash
# === IMMEDIATE NEEDS ===

# What errors just happened?
journalctl -p err -b -e

# What's happening right now?
journalctl -f

# Why did a service fail?
journalctl -u <service> -e -n 50

# What happened at boot?
journalctl -b | head -200

# Kernel issues?
dmesg -T | grep -i error

# === DEEPER INVESTIGATION ===

# All errors last hour
journalctl --since "1 hour ago" -p err

# Search for specific error
journalctl -g "pattern" -b

# Auth issues
journalctl -u sshd -u systemd-logind -p warning

# Disk issues
journalctl -b | grep -iE "sd|nvme|io error|sector"

# Memory issues
journalctl -b | grep -iE "oom|out of memory|swap"

# === LOG MAINTENANCE ===

# Check log disk usage
journalctl --disk-usage

# Clean old logs
sudo journalctl --vacuum-time=2weeks
```
