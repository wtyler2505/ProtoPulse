---
description: "Topic map for ProtoPulse procurement — identifiers and contracts that let a design cross the boundary from schematic intent to physically purchased parts: MPN as the manufacturer contract, supplier SKU as the disposable distributor contract, and the BOM-export flow that resolves one into the other."
type: moc
topics:
  - "[[index]]"
  - "[[eda-fundamentals]]"
  - "[[architecture-decisions]]"
---

# procurement

Procurement is the layer that converts "I want a 10k 0603 resistor" into "ship this reel to this address." It is where EDA meets supply chain, and where the identity rules become load-bearing: a design that works in simulation means nothing if it cannot be BOM-exported to a real distributor.

## Synthesis

The organizing principle is **stable identity upstream, disposable identity downstream**. The manufacturer part number is the immutable contract — Yageo's `RC0603FR-0710KL` will refer to the same 10 kΩ 1% 0603 resistor for as long as Yageo makes it. The distributor SKU (DigiKey `311-10.0KHRCT-ND`, Mouser `603-RC0603FR-0710KL`) is a resolution mechanism — it maps the MPN to a stock line, and it is replaceable the moment supply, pricing, or carrier changes.

Designs must be keyed on MPN. Cart lines may be keyed on SKU. Mixing the two creates "phantom" parts — BOMs that cannot re-resolve after a distributor deprecates a line, or worse, BOMs that silently substitute a different part because the SKU was the only record.

## Core Ideas

- [[component-mpn-is-the-manufacturer-contract-and-supplier-sku-is-the-distributor-contract-and-only-mpn-is-stable-across-sources]] — the identity rule: MPN anchors design intent across manufacturers, SKU resolves it at each distributor; store both, but design references the MPN

## Adjacent topics

- [[moc-component-metadata-fields]] — the broader `(family, mounting, package, MPN)` metadata quadrant; MPN is the procurement-facing edge of that model
- [[eda-fundamentals]] — parent domain hub for all EDA concerns

## Open Questions

- Where does drop-in-equivalence metadata live? Yageo RC0603 ↔ Panasonic ERJ ↔ Vishay CRCW are all 10k 1% 0603 resistors from distinct manufacturers; the procurement layer benefits from an equivalence graph separate from MPN identity.
- Should BOM-export surface a "confidence" field reflecting single-source vs multi-source-available parts?
- Does the design need a "preferred distributor" per project (cost vs lead-time trade-off), or should MPN stay distributor-agnostic and resolution happen at export time?

## Agent Notes

When extending the schema to cover procurement, resist adding SKU fields to the parts table itself. SKUs belong in a cart or order table keyed by `(part_id, distributor)` — the parts table stays pure on MPN.

---

Topics:
- [[index]]
- [[eda-fundamentals]]
- [[architecture-decisions]]
