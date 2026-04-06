---
description: "calculateBuildRiskScore accesses item.assemblyCategory and item.esdSensitive but bom_items table has no such columns — risk engine is silently broken"
type: debt-note
source: "conductor/comprehensive-audit.md §30"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/ai-tools/risk-analysis.ts", "shared/schema.ts"]
---

# Risk analysis tool references nonexistent schema columns so THT and ESD risk scores are always zero

In `server/ai-tools/risk-analysis.ts`, the `calculateBuildRiskScore` function loops over `bomItems` and accesses `item.assemblyCategory` and `item.esdSensitive`. Cross-referencing `shared/schema.ts` reveals that the `bom_items` table does not contain these columns. The ORM returns `undefined`, meaning the risk analysis engine silently skips THT and ESD assembly risk calculations — producing artificially low risk scores.

Similarly, the `analyze_bom_optimization` tool uses hardcoded static dictionaries (RESISTOR_PACKAGES, IC_ALTERNATES) completely decoupled from the PostgreSQL `component_library` table — suggesting parts that don't exist in the project database.

---

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] -- risk + procurement data both broken
- [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] -- pattern of tools operating on fake data

Topics:
- [[architecture-decisions]]
