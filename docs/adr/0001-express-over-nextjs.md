# ADR-0001: Express 5 over Next.js

**Status:** Accepted
**Date:** 2026-01-15 (retroactive)
**Deciders:** Tyler

## Context

ProtoPulse is a browser-based EDA tool — a single-page application with complex interactive canvases (architecture diagrams, schematic editor, waveform viewer). The server primarily serves a REST API and streams AI responses via SSE.

## Decision

Use Express 5 as the API server with Vite serving the React SPA, rather than adopting Next.js or another full-stack framework.

## Rationale

- **No SSR needed**: EDA tools are interactive applications, not content sites. SEO is irrelevant. First-load performance is secondary to runtime interactivity.
- **Separation of concerns**: The API layer (Express) and UI layer (Vite/React) evolve independently. Route changes on either side don't affect the other.
- **SSE streaming simplicity**: Express makes Server-Sent Events trivial. Framework abstractions (Next.js API routes, edge functions) add complexity without benefit.
- **Deployment flexibility**: Can deploy API and static assets separately if needed (CDN for SPA, container for API).
- **Express 5 pre-release risk**: Acknowledged — see CAPX-SEC-20 for monitoring plan and rollback procedure.

## Consequences

- Manual API route organization (no file-system routing) — mitigated by TD-08 domain router decomposition.
- No built-in ISR/SSG — not needed for a tool application.
- Must handle CORS, security headers, rate limiting manually — using helmet + express-rate-limit.
