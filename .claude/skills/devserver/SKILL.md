---
name: devserver
description: Manage the ProtoPulse dev server — start, stop, or check status via tmux
disable-model-invocation: true
---

# /devserver

Manage the ProtoPulse development server. Starts on port 5000 via tmux for persistent background operation.

## Arguments

- (none) — Start the dev server (default action)
- `stop` — Stop the dev server
- `status` — Check if the dev server is running
- `restart` — Stop and restart the dev server

## Actions

### Start (default)

1. **Check for existing server on port 5000:**
   ```bash
   lsof -i :5000 -t 2>/dev/null
   ```

2. **If port is occupied:**
   - Check if it's our tmux session: `tmux has-session -t dev 2>/dev/null`
   - If it's our session and healthy: report "already running" and exit
   - If it's a stale process: kill it
     ```bash
     kill $(lsof -i :5000 -t) 2>/dev/null
     ```
   - Wait 2 seconds for port to free up

3. **Kill any existing tmux dev session:**
   ```bash
   tmux kill-session -t dev 2>/dev/null
   ```

4. **Start new tmux session:**
   ```bash
   tmux new-session -d -s dev -c /home/wtyler/Projects/ProtoPulse "npm run dev"
   ```

5. **Health check (wait for startup):**
   - Wait 5 seconds for the server to initialize
   - Then poll up to 10 times (1 second apart):
     ```bash
     curl -s -o /dev/null -w "%{http_code}" http://localhost:5000
     ```
   - Success: HTTP 200 response
   - If still not responding after 10 attempts: check tmux logs
     ```bash
     tmux capture-pane -t dev -p | tail -20
     ```

6. **Report:**
   ```
   Dev server started:
     Port: 5000
     URL: http://localhost:5000
     tmux session: dev
     Status: HTTP 200

   To view logs: tmux attach -t dev
   To stop: /devserver stop
   ```

### Stop

1. **Kill tmux session:**
   ```bash
   tmux kill-session -t dev 2>/dev/null
   ```

2. **Kill any remaining processes on port 5000:**
   ```bash
   kill $(lsof -i :5000 -t) 2>/dev/null
   ```

3. **Verify port is free:**
   ```bash
   lsof -i :5000 -t 2>/dev/null
   ```

4. **Report:**
   ```
   Dev server stopped.
     Port 5000: free
     tmux session "dev": terminated
   ```

### Status

1. **Check port:**
   ```bash
   lsof -i :5000 -t 2>/dev/null
   ```

2. **Check tmux session:**
   ```bash
   tmux has-session -t dev 2>/dev/null && echo "exists" || echo "none"
   ```

3. **Health check (if port is in use):**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5000
   ```

4. **Get recent logs (if tmux session exists):**
   ```bash
   tmux capture-pane -t dev -p | tail -10
   ```

5. **Report:**
   ```
   Dev server status:
     Port 5000: {in use / free}
     Process PID: {pid or N/A}
     tmux session: {exists / none}
     HTTP health: {200 / timeout / N/A}
     Recent logs:
       {last 5 lines}
   ```

### Restart

1. Execute the Stop action
2. Wait 2 seconds
3. Execute the Start action

## Error Handling

- If `npm run dev` fails to start: capture tmux output and report the error
- If port 5000 is used by a non-ProtoPulse process: report the PID and process name, ask user before killing
- If tmux is not installed: tell the user to install it (`sudo apt install tmux`)
- If health check keeps failing: show the last 20 lines of tmux output for debugging

## Notes

- The tmux session name is always `dev` — this is consistent across the project
- The working directory is always `/home/wtyler/Projects/ProtoPulse`
- Do NOT use `&` or `nohup` — tmux handles backgrounding
- The dev server runs Vite + Express on port 5000 (both frontend and API)
