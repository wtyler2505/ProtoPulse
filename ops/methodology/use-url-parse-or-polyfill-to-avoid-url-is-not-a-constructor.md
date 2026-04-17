---
description: Ensure robust URL parsing by using polyfills or dedicated libraries instead of relying on the global URL constructor
type: methodology
category: processing
source: session-mining
created: 2026-04-17
status: active
session_source: current-session
---

# use url parse or polyfill to avoid URL is not a constructor

## What to Do

When resolving or manipulating URLs in environments that may lack full standard support (such as certain React Native/Expo contexts), explicitly import a robust parsing library (like `url-parse`) or ensure the `react-native-url-polyfill` is applied. 

## What to Avoid

Do not blindly rely on `new URL()` without verifying that the global `URL` constructor is fully implemented and available in the target runtime.

## Why This Matters

Relying on the global `URL` constructor can lead to runtime crashes with the `TypeError: URL is not a constructor` error, completely breaking navigation or data fetching logic. 

## Scope

This applies primarily to frontend/mobile code (like PartScout) that runs in React Native/Expo or other non-standard JavaScript environments where global APIs may differ from modern browsers or Node.js.

---

Related: [[methodology]]
