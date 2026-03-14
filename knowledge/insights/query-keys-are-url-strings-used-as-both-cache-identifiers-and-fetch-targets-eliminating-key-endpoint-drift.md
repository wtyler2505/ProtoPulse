---
summary: React Query keys are the literal API URL strings, and the global queryFn fetches from queryKey[0] — so cache keys and endpoints can never diverge
category: convention
areas: ["[[architecture]]", "[[conventions]]"]
wave: "extraction"
---

# Query keys are URL strings used as both cache identifiers and fetch targets, eliminating key-endpoint drift

In `client/src/lib/queryClient.ts`, the default `queryFn` extracts the URL directly from `queryKey[0]`:

```ts
const rawUrl = queryKey[0] as string;
const url = sanitizeUrl(rawUrl);
const res = await fetch(url, { headers: getAuthHeaders(), credentials: "include" });
```

This means every `useQuery({ queryKey: ['/api/projects/1/nodes'] })` call uses that string as both the cache key AND the fetch URL. There is no separate key-to-URL mapping that could get out of sync.

Consequences:
- **Zero key-endpoint drift.** In a typical React Query setup, you define `queryKey: ['nodes', projectId]` and a separate `queryFn: () => fetch(...)`. If someone changes the URL but not the key (or vice versa), the cache breaks silently. Here, changing the key automatically changes the URL.
- **Invalidation is URL-based.** `queryClient.invalidateQueries({ queryKey: ['/api/projects/1/nodes'] })` invalidates exactly the URL that was fetched.
- **URL sanitization is centralized.** `sanitizeUrl()` collapses double slashes and strips trailing slashes, handling edge cases from string interpolation like `/api/projects/${id}//bom`.
- **Auth is transparent.** `getAuthHeaders()` injects the `X-Session-Id` header on every request via the global queryFn, so individual queries never need to think about auth.

The tradeoff: query keys are less semantic. You can't easily query "all node-related queries" without knowing the URL pattern. But for this codebase with 10 domain contexts each managing their own queries, the drift-free guarantee is worth more.

---

Related:
- [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — queryClient is the server-state authority that localStorage features bypass

Areas:
- [[architecture]]
- [[conventions]]
