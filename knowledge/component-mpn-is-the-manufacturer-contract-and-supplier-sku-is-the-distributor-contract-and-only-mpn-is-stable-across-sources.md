---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: Manufacturer Part Number (MPN) is a manufacturer-assigned identifier that uniquely resolves device + package + spec grade...
type: reference
confidence: proven
topics:
- moc-component-metadata-fields
- eda-fundamentals
- procurement
related_components: []
---
# component MPN is the manufacturer contract and supplier SKU is the distributor contract and only MPN is stable across sources

MPN (Manufacturer Part Number) is the identifier the component's *maker* assigns. Supplier SKU is the identifier a *distributor* assigns to a listing of that part in their catalog. These get conflated constantly and the conflation corrupts BOMs, inventory, and procurement.

## The contract each one represents

- **MPN** is the manufacturer's promise: "a part labeled `ATMEGA328P-PU` will meet the ATmega328P datasheet in the PDIP-28 package with `-PU` grade (industrial, -40°C to 85°C, lead-free)." This identifier travels across distributors, surplus markets, counterfeits, and decades. It is the canonical name.
- **Supplier SKU** is the distributor's promise: "order number `ATMEGA328P-PU-ND` at Digi-Key will ship you *a unit* that matches that MPN." Same part, different number at Mouser (`556-ATMEGA328P-PU`), different again at LCSC (`C14877`), and completely absent at a distributor who doesn't stock it.

The implication: **a BOM keyed on SKU cannot be sourced from anywhere else.** A BOM keyed on MPN can be priced across every distributor simultaneously.

## What an MPN actually encodes

An MPN is not an opaque string. Manufacturers encode, in deterministic suffixes, the variants that share a datasheet but differ physically or spec-wise:

Using `ATMEGA328P-AU` as an example:
- `ATMEGA328P` — the device (die, feature set, datasheet)
- `-A` — TQFP-32 package (vs `-PU` PDIP-28, `-MU` QFN-32)
- `U` — lead-free / RoHS compliance
- Temperature grade and tape-and-reel suffixes can follow on longer parts

The practical rule: **the MPN root (before the first suffix) identifies the device; the suffix identifies the physical/grade variant.** Two MPNs with the same root but different suffixes share a datasheet but are *not* drop-in replaceable — the package differs, so the footprint differs, so the board differs.

## Canonical vs variant

- **Canonical MPN** — the full manufacturer-stamped string with all suffixes (`LM317T`, not `LM317`)
- **Variant** — any MPN differing only in reel-size, packaging, or label suffix that ships the same silicon in the same package

Some manufacturers (TI, ST) are rigorous; some (generic Chinese passives) append batch codes to the "MPN" that are really SKUs in disguise. For those, the MPN is only reliable down to `device + package + tolerance + temperature coefficient`, and reel-size is treated as procurement metadata, not part identity.

## When generic symbols are acceptable and when MPN-locked symbols are required

| Use case | Symbol |
|----------|--------|
| Schematic-level logic, behavioral simulation | Generic family symbol (`R`, `C`, `Q`) is fine |
| BOM generation, procurement | MPN-locked required; distributor cannot guess what `R 10k` is |
| Critical component (MCU, regulator, ADC) | MPN-locked always; pinout is MPN-specific |
| Substitutable passive (any 0603 10k 1% X7R) | Family symbol + spec attributes, MPN deferred to build time |
| Tight tolerance or exotic spec (NP0/C0G timing caps) | MPN-locked; [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]] is not guaranteed by any dielectric family lookup |

The anti-pattern is locking every passive to a specific MPN at schematic time. It makes the BOM brittle (if Yageo is out of stock, the Panasonic equivalent should be a swap, not a redesign). The opposite anti-pattern is refusing to lock any MPN; then the assembly house orders whatever is cheapest and your 100MHz oscillator ends up with a Y5V load cap.

Since [[all-procurement-data-is-ai-fabricated]], ProtoPulse's part model must treat MPN as authoritative only when it comes from a verified datasheet source, and treat supplier SKUs as disposable resolution metadata that can be regenerated from the MPN + supplier catalog query.

---

Relevant Notes:
- [[component-family-groups-parts-by-electrical-role-not-by-manufacturer-or-package]] — family is above MPN in the taxonomy; many MPNs share a family
- [[component-package-type-imperial-0603-and-metric-1608-are-the-same-physical-part-with-different-naming-conventions]] — MPN suffix usually encodes the package variant
- [[all-procurement-data-is-ai-fabricated]] — fabricated MPNs are the canonical failure mode to defend against
- [[parts-ingress-uses-best-effort-dual-write-with-audit-log]] — how the parts database records MPN provenance

Topics:
- [[moc-component-metadata-fields]]
- [[eda-fundamentals]]
- [[procurement]]
