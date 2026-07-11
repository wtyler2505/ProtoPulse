# ProtoPulse Test Coverage — Ralph Loop Prompt

## Project

ProtoPulse: browser-based EDA tool at `/home/wtyler/Projects/ProtoPulse`.
Stack: React 19 + TypeScript + Vite 7 + Express 5 + PostgreSQL + Drizzle ORM + Vitest.

## Your Mission

Systematically increase test coverage to **70%+ line coverage**. You are in a loop — each iteration you will see your previous work in the files. Build incrementally.

## Each Iteration

```
1. Run:  npx vitest run --coverage 2>&1 | tail -80
2. Read the coverage summary — identify the lowest-covered files
3. Pick the highest-priority UNTESTED module (see Priority Order below)
4. Write tests for it, following Existing Patterns exactly
5. Run:  npx vitest run 2>&1 | tail -40
6. Fix any failures
7. Run coverage again — record the new %
8. If overall line coverage >= 70%, output: <promise>COVERAGE COMPLETE</promise>
```

Do NOT write tests for files that already have good coverage. Focus on the gaps.

## Priority Order (test these first)

### Tier 1 — Core Business Logic (highest impact)
1. `shared/schema.ts` — Zod insert schema validation (test that valid data passes, invalid data rejects)
2. `shared/drc-engine.ts` — Design Rule Check logic (pure functions, easy to test)
3. `server/storage.ts` — DatabaseStorage methods (mock `db` with vi.fn())
4. `server/auth.ts` — Session creation, API key encryption/decryption, header extraction
5. `server/ai.ts` — System prompt builder, action parser, error categorizer (partially tested — expand)
6. `client/src/lib/project-context.tsx` — Mutations: addNode, updateNode, deleteNode, addBomItem, etc.

### Tier 2 — Generators & Exporters
7. `server/gerber-generator.ts` — Gerber output format correctness
8. `server/eagle-exporter.ts` — Eagle XML format
9. `server/kicad-exporter.ts` — KiCad s-expression format
10. `server/spice-exporter.ts` — SPICE netlist format
11. `server/pdf-generator.ts` — PDF generation
12. `server/export-generators.ts` — Export orchestration
13. `server/svg-parser.ts` — SVG parsing utilities

### Tier 3 — Client Logic (non-UI)
14. `client/src/lib/circuit-editor/wire-router.ts` — Wire routing algorithm
15. `client/src/lib/circuit-editor/hooks.ts` — Circuit editor hooks
16. `client/src/lib/component-editor/` — Constraint solver, diff engine, snap engine, DRC, validation
17. `client/src/lib/contexts/chat-context.tsx` — Chat state management
18. `client/src/lib/contexts/history-context.tsx` — Undo/redo history
19. `client/src/lib/utils.ts`, `csv.ts`, `clipboard.ts` — Pure utilities

### Tier 4 — React Components (test behavior, not paint)
20. `client/src/components/panels/ChatPanel.tsx` — Message send, settings toggle, streaming state
21. `client/src/components/layout/Sidebar.tsx` — Collapse/expand, search, navigation
22. `client/src/components/views/ArchitectureView.tsx` — Node add/delete, edge connect
23. `client/src/components/views/ProcurementView.tsx` — BOM edit, sort, filter
24. `client/src/components/views/ValidationView.tsx` — Issue display, severity filtering

### Tier 5 — Skip These
- `client/src/components/ui/*` — shadcn/ui primitives (third-party, already tested upstream)
- `server/index.ts` — Entry point bootstrapping
- `server/vite.ts` — Dev server integration
- `server/logger.ts` — Winston config wrapper

## Existing Patterns (FOLLOW EXACTLY)

### Server Tests — Pure unit tests, minimal mocking

```typescript
// File: server/__tests__/<module>.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Direct imports, test pure functions
import { LRUClientCache } from '../lib/lru-cache';

describe('LRUClientCache', () => {
  it('evicts LRU key when maxSize exceeded', () => {
    const cache = new LRUClientCache<string>(3);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    cache.set('d', 'D');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe('D');
  });
});
```

### Client Hook Tests — Mock HTTP + contexts

```typescript
// File: client/src/lib/contexts/__tests__/<context>.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API layer
vi.mock('@/lib/queryClient', async () => {
  const actual = await vi.importActual('@/lib/queryClient');
  return { ...actual, apiRequest: vi.fn() };
});

// Mock toast
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
  return { Wrapper, queryClient };
}
```

### Client Component Tests — Render + interact

```typescript
// File: client/src/components/__tests__/<component>.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Render with all needed providers, assert on DOM output
```

## Rules

1. **One module per iteration.** Don't try to cover everything at once.
2. **Test file naming:** `server/__tests__/<name>.test.ts` for server, co-locate in `__tests__/` dirs for client.
3. **No snapshot tests.** Use explicit assertions.
4. **Mock boundaries, not internals.** Mock `apiRequest`, `db`, `fetch` — not internal functions.
5. **Each test file must pass independently.** Run `npx vitest run <path>` to verify.
6. **Import aliases:** `@/` = `client/src/`, `@shared/` = `shared/`.
7. **Never modify source code to make tests pass.** Tests adapt to the code, not vice versa.
8. **If a test is flaky or impossible to write (needs real DB, real AI), skip it and move to next priority.**
9. **Minimum 5 test cases per file.** Cover happy path, edge cases, error cases.
10. **Run `npm run check` after writing tests** to ensure no TypeScript errors.

## Completion

When `npx vitest run --coverage` shows **overall line coverage >= 70%**, output:

```
<promise>COVERAGE COMPLETE</promise>
```

If after 5 consecutive iterations you cannot increase coverage (stuck on untestable code), output:

```
<promise>COVERAGE PLATEAU</promise>
```
