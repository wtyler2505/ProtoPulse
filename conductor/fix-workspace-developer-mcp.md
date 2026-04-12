# Objective
Completely resolve the `-32001: Request timed out` error when Gemini CLI connects to the `workspace-developer` MCP server by bulletproofing the `proxy.js` communication bridge.

# Background & Motivation
My extensive analysis of the `proxy.js` script and the Gemini CLI logs reveals a critical flaw in how the proxy handles upstream failures from the `workspace-developer.goog/mcp` endpoint. 
When the Google backend experiences latency, rate limiting, or gateway errors (returning HTML instead of an SSE stream), `proxy.js` fails to parse the response because it only looks for lines starting with `data:` or `{`. As a result, it silently ignores the error and writes **nothing** to `stdout`. The Gemini CLI MCP client, expecting a JSON-RPC response with a matching request ID, is left waiting indefinitely until it hits its 60-second timeout. 

# Proposed Solution
To make the MCP connection rock-solid, I will completely rewrite the `proxy.js` script to include:
1.  **Synthetic JSON-RPC Errors:** If the HTTP request fails or returns an unparseable response (like an HTML 502 page), the proxy will extract the `id` from the original request and instantly generate a compliant JSON-RPC error response. This tells the CLI exactly what failed without making it wait.
2.  **Fetch AbortController Timeout:** Introduce a strict 30-second timeout on the `fetch` call using an `AbortController`. If the Google API hangs, the proxy will forcefully terminate the request and return a timeout error to the CLI.
3.  **Resilient Queueing:** Enhance the async queue to guarantee it always advances to the next message, even if a fatal network exception occurs, preventing deadlocks in the stdio pipeline.

# Implementation Steps
1.  Overwrite `/home/wtyler/.gemini/extensions/google-workspace-developer-tools/proxy.js` with the new, battle-tested implementation.
2.  The new script will parse the incoming JSON request to extract the `id`.
3.  It will wrap the `fetch` call in a `try/catch` and an `AbortSignal`.
4.  If parsing `dataBuffer` yields no valid JSON, it will `process.stdout.write` a synthesized `{"jsonrpc":"2.0","id":<req.id>,"error":{"code":-32001,"message":"Upstream API failed"}}`.

# Verification & Testing
- I will simulate a broken upstream connection to verify the proxy instantly returns a synthesized JSON-RPC error instead of hanging.
- Run `gemini extensions list` and ensure the MCP server connects and loads tools instantly without timeouts.