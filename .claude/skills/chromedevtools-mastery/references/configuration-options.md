# Chrome DevTools MCP Configuration Options

## Server CLI Arguments

Pass via `args` in MCP config:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "/path/to/chrome-devtools-mcp",
      "args": ["--headless=true", "--isolated=true"]
    }
  }
}
```

### Connection Options

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--browserUrl`, `-u` | string | | Connect to running Chrome via port forwarding |
| `--wsEndpoint`, `-w` | string | | WebSocket endpoint (e.g., `ws://127.0.0.1:9222/devtools/browser/<id>`) |
| `--wsHeaders` | string | | JSON headers for WebSocket (e.g., `'{"Authorization":"Bearer token"}'`) |

### Browser Options

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--headless` | boolean | false | Run without UI (invisible) |
| `--executablePath`, `-e` | string | | Path to custom Chrome binary |
| `--isolated` | boolean | false | Use temp profile (auto-cleaned) |
| `--channel` | string | stable | Chrome channel: stable, canary, beta, dev |
| `--viewport` | string | | Initial size, e.g., `1280x720` (max 3840x2160 headless) |

### Network Options

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--proxyServer` | string | | Proxy server URL |
| `--acceptInsecureCerts` | boolean | false | Ignore SSL errors (use with caution) |

### Debug Options

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--logFile` | string | | Write debug logs to file |
| `--chromeArg` | array | | Additional Chrome args |

### Feature Toggles

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--categoryEmulation` | boolean | true | Enable emulation tools |
| `--categoryPerformance` | boolean | true | Enable performance tools |
| `--categoryNetwork` | boolean | true | Enable network tools |

## User Data Directory

Default profile locations:
- **Linux/macOS**: `$HOME/.cache/chrome-devtools-mcp/chrome-profile-$CHANNEL`
- **Windows**: `%HOMEPATH%/.cache/chrome-devtools-mcp/chrome-profile-$CHANNEL`

Use `--isolated=true` for temp profile that auto-cleans.

## Connecting to Running Chrome

### Step 1: Start Chrome with debug port

**Linux**:
```bash
/usr/bin/google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile
```

**macOS**:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile
```

**Windows**:
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile"
```

### Step 2: Configure MCP

```json
{
  "chrome-devtools": {
    "command": "chrome-devtools-mcp",
    "args": ["--browser-url=http://127.0.0.1:9222"]
  }
}
```

## Common Configurations

### Headless Automation
```json
{
  "args": ["--headless=true", "--isolated=true", "--viewport=1920x1080"]
}
```

### Testing on Canary
```json
{
  "args": ["--channel=canary"]
}
```

### With Proxy
```json
{
  "args": ["--proxyServer=http://proxy.example.com:8080"]
}
```

### Debug Mode
```json
{
  "args": ["--logFile=/tmp/chrome-mcp.log"],
  "env": {"DEBUG": "*"}
}
```

## Known Limitations

1. **Sandboxed MCP clients** - Some clients sandbox MCP servers. Chrome needs sandbox permissions. Either disable sandboxing for chrome-devtools-mcp or use `--browser-url` to connect to externally-started Chrome.

2. **Single trace at a time** - Only one performance trace can run. Stop existing trace before starting new one.

3. **Headless max viewport** - 3840x2160px maximum in headless mode.

4. **Remote debugging security** - Debug port exposes browser to any local application. Don't browse sensitive sites while port is open.
