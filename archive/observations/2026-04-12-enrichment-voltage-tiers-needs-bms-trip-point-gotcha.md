---
observed_date: 2026-04-12
category: enrichment
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
target_note: "actuator-voltage-tiers-map-to-distinct-power-supply-strategies"
---

# enrichment: actuator-voltage-tiers-map-to-distinct-power-supply-strategies needs BMS trip point gotcha

The hoverboard motor source adds a concrete system-level gotcha: 4-motor BLDC peak draw (~60A) exceeds typical hoverboard BMS trip point (30-40A), causing sudden power loss under load. The existing note covers power rail isolation and fusing but does not mention BMS capacity as a limiting factor when scaling motor count beyond original hoverboard design.

Action: Update [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] with BMS trip point constraint from source lines 59-69, and the solution hierarchy (firmware limiting, BMS upgrade, dual battery packs).
