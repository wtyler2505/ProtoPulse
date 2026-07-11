---
description: Configure bash timeout values in Claude Code settings
category: claude-setup
allowed-tools: Read, Edit, Write
argument-hint: "<duration> [scope]"
---
# Configure Bash Timeout Settings

Configure the bash command timeout values in your Claude Code settings.json file. Claude Code's stock default is 2 minutes (120000ms), which is insufficient for long-running operations like builds, tests, or deployments.

**House rule (recommended default): 60 minutes (3600000ms).** Tyler's standing instruction is that timeouts for all commands are set to no less than 60 minutes unless specifically stated otherwise, and anything expected to run longer than 30 minutes runs in the background. When no duration is given, configure 3600000ms.

## Current Settings

User settings:
!if [ -f ~/.claude/settings.json ]; then if command -v jq &>/dev/null; then cat ~/.claude/settings.json | jq '.env // {}' 2>/dev/null; else cat ~/.claude/settings.json | grep -A 10 '"env"' 2>/dev/null || echo "No env settings found"; fi; else echo "No user settings file"; fi

Project settings:
!if [ -f .claude/settings.json ]; then if command -v jq &>/dev/null; then cat .claude/settings.json | jq '.env // {}' 2>/dev/null; else cat .claude/settings.json | grep -A 10 '"env"' 2>/dev/null || echo "No env settings found"; fi; else echo "No project settings file"; fi

## Available Timeout Settings
- **BASH_DEFAULT_TIMEOUT_MS**: The default timeout for bash commands (in milliseconds)
- **BASH_RENDER_TIMEOUT_MS**: The timeout for rendering (if applicable) or other shell bounds
- **BASH_COMMAND_TIMEOUT_MS**: The timeout for specific commands

## Available Timeout Settings
- **BASH_DEFAULT_TIMEOUT_MS**: The default timeout for bash commands (in milliseconds)

## Steps:
1. Check if a settings file exists (project or user level)
2. Verify its JSON format
3. Update or create the `env` section with:
   - `BASH_DEFAULT_TIMEOUT_MS`: specified duration (converted to ms)
   - `BASH_MAX_TIMEOUT_MS`: 2x default timeout
4. Save the file and confirm changes

## Common Timeout Values
- 2 minutes: 120000 (Claude Code stock default   too short for this setup)
- 10 minutes: 600000
- 30 minutes: 1800000
- 60 minutes: 3600000 (**house-rule recommended default**)
- 120 minutes: 7200000

## Configure Settings
1. First, check if settings.json exists in the appropriate location
2. Read the current settings to preserve existing configuration
3. Add or update the `env` section with the desired timeout values
4. Maintain all existing settings (hooks, etc.)

### For User-Level Settings (~/.claude/settings.json)
- Applies to all projects for the current user
- Location: `~/.claude/settings.json`

### For Project-Level Settings (.claude/settings.json)
- Applies only to the current project
- Location: `.claude/settings.json`
- Project settings override user settings

## Arguments
Specify the timeout duration (e.g., "10min", "20min", "5m", "600s") and optionally the scope:
- `$ARGUMENTS` format: `[duration] [scope]`
- Duration: Optional   defaults to "60min" (house rule) when omitted
- Scope: Optional - "user" (default) or "project"

Examples:
- `/config:bash-timeout` - Set user-level timeout to the house default, 60 minutes
- `/config:bash-timeout 60min` - Set user-level timeout to 60 minutes
- `/config:bash-timeout 90min project` - Set project-level timeout to 90 minutes

## Implementation Steps
1. Parse the arguments to extract duration and scope (no duration   use 60min / 3600000ms; reject anything below 60min unless Tyler explicitly insists)
2. Convert duration to milliseconds
3. Determine the settings file path based on scope
4. Read existing settings if the file exists
5. Update or add the env section with new timeout values
6. Set BASH_DEFAULT_TIMEOUT_MS to the specified value
7. Set BASH_MAX_TIMEOUT_MS to 2x the default value (so 7200000ms when using the 60-min default)
8. Write the updated settings back to the file
9. Confirm the changes to the user

## Example Configuration
```json
  "env": {
    "BASH_DEFAULT_TIMEOUT_MS": "3600000",
    "BASH_MAX_TIMEOUT_MS": "7200000"
  },
  "hooks": {
    // existing hooks configuration...
  }
```

This sets:
- Default timeout: 60 minutes (3600000ms)   the house-rule default
- Maximum timeout: 120 minutes (7200000ms)

Reminder: commands expected to exceed 30 minutes should run in the background (`run_in_background`) regardless of timeout settings.
