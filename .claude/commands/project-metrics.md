---
description: Comprehensive project health analysis with metrics and recommendations
allowed-tools: Read, Bash, Grep, Glob, mcp__desktop-commander__*, mcp__memory__*
argument-hint: "[evaluation-period] | --30-days | --sprint | --quarter | --comprehensive"
---
# Project Metrics
Analyze comprehensive project health and metrics: **$ARGUMENTS**

## Current Project State
- Git activity: !`git log --oneline --since="30 days ago" | wc -l`
- Contributors: !`git shortlog -sn --since="30 days ago" | head -5`
- Branch status: !`git branch -r | wc -l` remote branches
- Code changes: !`git diff --stat HEAD~30 2>/dev/null || echo "Not enough history"`

## Health Analysis
**Evaluation Period**: Use $ARGUMENTS or default to last 30 days

### 1. Code Quality Metrics
- Test coverage and trends
- Code complexity analysis
- Security vulnerabilities (npm audit or equivalent)
- Technical debt indicators

### 2. Delivery Performance
- Sprint velocity trends (if task management available)
- Cycle time analysis
- Bug vs feature ratio
- On-time delivery metrics

### 3. Team Health Indicators
- PR review turnaround time
- Commit frequency distribution
- Work distribution balance
- Knowledge concentration risk

### 4. Dependency Health
- Outdated packages assessment
- Security audit results
- License compliance check
- External service dependencies

## Output Format
Generate markdown report with:
- Overall health score (0-100) with color-coded status
- Executive summary with key findings
- Detailed metrics tables (current vs target)
- Trend analysis and risk assessment
- Actionable recommendations prioritized by impact
