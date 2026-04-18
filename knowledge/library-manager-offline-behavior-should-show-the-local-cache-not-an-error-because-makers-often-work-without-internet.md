---
description: The Library Manager typically fetches a registry index on every open; falling back to the local cache when offline lets makers keep working on benches without WiFi instead of hitting a connection error they can't resolve
type: claim
created: 2026-04-18
topics:
  - "[[maker-ux]]"
---

# library manager offline behavior should show the local cache not an error because makers often work without internet

Maker benches are not always connected. Garages, basements, workshops with bad WiFi, offline-by-policy corporate environments, plane seats, camping hackathons. Yet most Arduino-flavored Library Managers fetch the registry index on every open and fail hard when the request times out — showing "Unable to fetch library index" or a blank list, as if the entire feature were unavailable.

This is wrong on two counts. First, previously installed libraries are local — they're on disk, already compiled, already usable. A hostile offline state can claim not to know about them. Second, the registry itself doesn't change minute-to-minute; a cached index from last online session is almost always good enough to browse and install from a local `.zip` or point to a previously downloaded library.

The correct layered fallback:

1. **Always-available surface:** installed libraries — read from disk, zero network dependency, fully browsable and manageable offline.
2. **Cached-registry surface:** last-fetched registry index served from disk with a stale badge ("Last updated 3 hours ago — working offline"). User can browse, read descriptions, queue installs for when connectivity returns.
3. **Live surface:** when online, refresh the index in the background and reconcile; show the stale badge until reconciliation finishes.

The error path becomes a toast, not a page-level failure: "Working offline — registry index is cached from [timestamp]."

This pattern generalizes to every ProtoPulse network-dependent surface: BOM pricing (use last-known prices with age badges), supplier stock checks (cached with "checked N hours ago"), firmware updates (queue for when online). Since [[all-procurement-data-is-ai-fabricated]] already flagged that network-dependent data needs careful trust framing, the corollary is that its absence needs equally careful framing — a feature that vanishes when offline is worse than one that says "I'm showing you stale data and here's how stale."

The deeper principle: **offline-first is not a mobile concept, it's a maker concept.** Desktop EDA tools pretending they need constant connectivity punish the exact environments makers build in.

---

Source: [[2026-04-18-e2e-arduino-tab-tested]] (edge cases worth testing, line 42)

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] — same trust-framing problem applied to different network-dependent data
- [[makers-need-one-tool-because-context-switching-kills-momentum]] — an offline-broken Library Manager pushes the user back to the Arduino IDE which handles this case

Topics:
- [[maker-ux]]
