---
description: "pricingLookupTool returns Math.random()*10 and inStock:true in production — AI confidently reports fake prices and availability to users"
type: debt-note
source: "conductor/comprehensive-audit.md §27"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/genkit.ts"]
---

# Production mock data in pricingLookupTool causes the AI to hallucinate fake component prices and stock

The `pricingLookupTool` in the Genkit setup returns hardcoded mock data (`Math.random() * 10` and `inStock: true`) to the AI. This mock tool runs in production. The AI confidently reports fabricated component prices and fake stock availability to users, who then design boards with potentially out-of-stock or mispriced components.

This directly degrades trust in the tool and compounds with the existing issue that all procurement data is AI-fabricated.

---

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] -- this is the root cause of fabricated procurement data
- [[ai-is-the-moat-lean-into-it]] -- trust erosion undermines the AI moat

Topics:
- [[architecture-decisions]]
