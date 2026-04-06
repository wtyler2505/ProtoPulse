---
description: Why these specific dimension positions were chosen for the ProtoPulse knowledge system
type: decision
confidence: proven
topics: ["[[methodology]]"]
---

# The ProtoPulse vault uses atomic granularity with heavy processing because EDA knowledge is dense and interconnected

The derivation conversation landed on these positions for specific
reasons tied to ProtoPulse's nature as an EDA platform built by
someone learning electronics.

## Atomic granularity
Electronics knowledge is naturally atomic. "Decoupling caps within
5mm of power pins" is a self-contained claim that applies across
many contexts. Lumping it into a "PCB Layout Tips" document loses
the composability. Atomic notes let the same claim appear in the
PCB layout topic map, the component placement topic map, and the
power integrity topic map simultaneously.

## Flat organization
ProtoPulse spans software architecture, electronics fundamentals,
competitive analysis, UX patterns, and more. Folder hierarchies
force a single taxonomy. A note about "KiCad's DRC catches unrouted