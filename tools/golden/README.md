# Golden-file tests

Known op-logs → known exports, **byte-exact**. A diff here is a contract
change: re-freeze deliberately (`npx tsx update-golden.ts`) and review the
diff like the API change it is. The export date is pinned
(`2026-01-01T00:00:00.000Z`) and all emission is sorted, so output is
deterministic by construction.

## Fixtures

| Fixture | What it is |
|---|---|
| `led-resistor` | Track 1 step 2: battery → 330Ω → LED, named rails |
| `traffic-light-555` | Track 1 deliverable shape: NE555 astable driving 3 LED branches |
| `probe-input-protection` | The Probe's channel input stage: header → 100k series → BAT54S rail clamp (pin 3 midpoint) + TVS, with a current_max constraint carrying its rationale |

Each directory: `ops.json` (literal op-log, schema-validated on load) +
`expected.net` (KiCad legacy-E netlist) + `expected.bom.csv`.

## KiCad acceptance status

The emitter mirrors the legacy `server/export/kicad/netlist.ts` shape —
the `(export (version "E") …)` S-expression with reserved
`(net (code 0) (name ""))` — which pcbnew's *Import Netlist* accepts and
which has shipped in ProtoPulse production exports. Direct pcbnew import
of these exact files has **not yet been re-verified by hand** (no KiCad in
the build container); first person with a KiCad install: import
`traffic-light-555/expected.net` into a blank board and tick this box:

- [ ] pcbnew import verified (KiCad version: ____, date: ____)
