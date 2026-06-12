---
slug: can-basics
title: CAN basics
ercCodes: []
---

## What it is

CAN is the bus built for hostile environments: two wires (CANH/CANL) carrying a differential signal, every node hearing every frame, and arbitration that lets the highest-priority message win without anyone's data being destroyed. A "dominant" bit is actively driven; a "recessive" bit is the bus relaxing — the same wired-AND idea as open-drain, scaled up and made differential.

## Why it bites

First bite: wiring an MCU's CAN TX/RX pins straight to the bus. Those pins speak logic levels for a *transceiver* chip; without one, nothing works and nothing explains why. Second bite: termination. An unterminated or single-terminated bus often works on the bench with short wires, then fails on the real harness — reflections corrupt frames intermittently, and the failure tracks cable length, not code. Third bite: the lonely node. CAN requires some other node to acknowledge every frame, so a single device on the bus transmits, gets no ACK, retries, and accumulates errors until it goes *error-passive* (the fault-confinement rules deliberately stop counting ACK errors there, so a lone node parks at error-passive and retransmits the same frame forever rather than reaching bus-off) — a self-test rig with one node fails by design, not by defect. Fourth: every node must agree on the bit rate *and* roughly on the sample point; one misconfigured node can poison the bus for everyone, which is uniquely democratic among the buses in this wiki.

## The numbers

Termination is one 120Ω resistor at *each end* of the bus — exactly two, regardless of node count; a healthy unpowered bus measures about 60Ω between CANH and CANL, which is the field test worth memorizing. Stubs off the main line should stay short — sub-meter at moderate rates, shorter as speed rises (hedge: vendor app notes carry the real stub-length tables). Classic CAN tops out at 1Mbps, with the usable bus length shrinking as the rate grows — the commonly cited textbook pairing is on the order of 40m at 1Mbps, much longer at 125kbps. Dominant beats recessive, so lower message IDs win arbitration.

## See it

On the virtual CAN bus, run a single node and watch the transmit error counter climb to error-passive and stick there while the frame retries forever — then add a second node and watch the same firmware succeed. Then delete one terminator and re-run over a modeled long harness: clean frames at the near node, corrupted at the far one.

## Go deeper

Related: [termination-at-hobby-scale](termination-at-hobby-scale), [uart-framing-and-baud-error](uart-framing-and-baud-error), [push-pull-vs-open-collector](push-pull-vs-open-collector), [i2c-electrical-model](i2c-electrical-model). Curriculum: Track 4 "Talking Chips" — the bus you graduate to when wires leave the desk. Canonical reference: Bosch CAN Specification 2.0 and ISO 11898, plus your transceiver's datasheet.
