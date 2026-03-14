---
name: Batch analysis tracking lives in an in-memory Map that does not survive server restarts
description: The Anthropic Message Batches integration stores batch metadata (projectId, analyses, status) in a module-scoped Map — server restart or crash loses all batch tracking, making it impossible to retrieve results for previously submitted batches without the batch ID
type: insight
category: reliability
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/batch-analysis.ts:64 — const activeBatches = new Map<string, BatchAnalysisStatus>()
  - server/batch-analysis.ts:372-376 — listProjectBatches() filters activeBatches by projectId
  - server/batch-analysis.ts:382-385 — getBatchProjectId() returns null for unknown batches
  - server/routes/batch.ts:32-57 — verifyBatchOwnership() depends on getBatchProjectId() which depends on in-memory state
---

# Batch Analysis Tracking Lives in an In-Memory Map That Does Not Survive Server Restarts

The `server/batch-analysis.ts` module tracks submitted Anthropic batch jobs in `activeBatches`, a module-scoped `Map<string, BatchAnalysisStatus>`. This map is the only link between a batch ID and its owning project. If the server restarts:

1. `listProjectBatches(projectId)` returns empty — the user's batch list disappears
2. `getBatchProjectId(batchId)` returns `null` — the ownership check in `verifyBatchOwnership()` throws 404
3. The batch is still running on Anthropic's servers, but the ProtoPulse server can no longer correlate it to a project or verify ownership

**Why this creates an orphaned-batch problem:** Anthropic batches can take hours to complete (50% cost = lower priority). A server deploy during batch processing orphans all in-flight batches. The user would need to manually track their batch IDs and query the Anthropic API directly to retrieve results.

**The custom_id encoding partially mitigates this:** Each batch request's `custom_id` is formatted as `${projectId}-${kind}-${Date.now()}`. The regex `customId.match(/^\d+-(.+?)-\d+$/)` in `getBatchResults()` can extract the analysis kind. But the batch-to-project mapping is only stored in the in-memory map, not embedded in the Anthropic batch metadata.

**Why it hasn't been fixed:** The batch feature was added as a cost optimization (50% cheaper than streaming). In practice, batches are likely short-lived (6 analyses × Haiku model = minutes, not hours). But the architecture doesn't guarantee this — large projects with complex prompts on slower models could take much longer.

---

Related:
- [[in-memory-server-state-is-an-authorization-bypass]] — this is the same pattern: in-memory state that gates authorization decisions is lost on restart
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — graceful shutdown doesn't persist activeBatches
