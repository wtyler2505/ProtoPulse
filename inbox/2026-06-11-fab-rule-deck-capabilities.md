# Fab capability verification — OSHPark + PCBWay 2-layer rule decks

Verified 2026-06-11 for `content/decks/oshpark-2layer-standard.json`
and `content/decks/pcbway-2layer-standard.json` (Vol I §6: "DRC rule
decks per manufacturer (JLC, PCBWay, OSHPark), versioned").

## OSHPark 2-layer prototype service
Source: https://docs.oshpark.com/services/two-layer/ (official docs)

| Rule | Spec | nm |
|---|---|---|
| trace width | 6 mil (0.1524 mm) | 152400 |
| trace spacing | 6 mil (0.1524 mm) | 152400 |
| min drill | 10 mil (0.254 mm) | 254000 |
| annular ring | 5 mil (0.127 mm) | 127000 |
| board edge keepout | 15 mil (0.381 mm) | 381000 |
| silkscreen line | 5 mil (0.127 mm) | 127000 |

Silkscreen source: OSH Park guidelines (5 mil minimum line thickness;
their Eagle docs recommend ≥6 mil for polygons) — secondary pages of
docs.oshpark.com.

## PCBWay standard service
Source: https://www.pcbway.com/capabilities.html (official capability table)

| Rule | Spec | nm |
|---|---|---|
| min trace | 0.1 mm (4 mil) | 100000 |
| min spacing | 0.1 mm (4 mil) | 100000 |
| min drill (CNC) | 0.15 mm | 150000 |
| annular ring | 0.15 mm (6 mil) | 150000 |
| copper to milled edge | 0.25 mm | 250000 |
| min legend (silk) width | 0.15 mm | 150000 |

Notes:
- These are CAPABILITY minimums; both fabs price some of them as
  premium options. The decks encode what the fab can manufacture —
  cost optimization is the Buyer's territory, not DRC's.
- Power-class 0.3 mm trace override copied from the JLC deck's house
  convention (engineering judgment, not a fab rule).
