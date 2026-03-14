---
name: Storage uses bind-delegation composition not inheritance creating a flat facade from 10 domain classes
description: DatabaseStorage in server/storage.ts composes 10 domain-specific storage classes (ProjectStorage, ArchitectureStorage, etc.) via explicit property assignment with .bind(), creating a flat IStorage-compatible facade without class inheritance, mixins, or dynamic delegation
type: insight
category: architecture
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/storage.ts:21-99 — DatabaseStorage class with 10 private domain instances and ~90 bind() delegations
  - server/storage/interfaces.ts:42-255 — IStorage interface with ~90 methods across 15 domain groups
  - server/storage/types.ts — StorageDeps type shared by all domain classes (db + cache)
  - server/storage/index.ts — barrel re-exports individual domain classes for testing
---

# Storage Uses Bind-Delegation Composition, Not Inheritance, Creating a Flat Facade from 10 Domain Classes

The `DatabaseStorage` class in `server/storage.ts` implements the ~90-method `IStorage` interface by composing 10 domain-specific classes, each receiving the same `StorageDeps` (db + cache). Each method is wired via explicit `.bind()`:

```ts
getProjects = this._projects.getProjects.bind(this._projects);
getProject = this._projects.getProject.bind(this._projects);
// ... ~90 more
```

**Why bind instead of inheritance/mixins/Proxy:**

1. **Not inheritance:** TypeScript doesn't support multiple class inheritance. 10 base classes can't be linearized into one.
2. **Not mixins:** TypeScript mixins require factory functions with constructor signatures. The domain classes have constructor dependencies (`StorageDeps`) that make mixin composition verbose.
3. **Not Proxy:** A Proxy-based approach (`new Proxy(this, { get: ... })`) would require dynamic method routing, losing type safety and making debugging harder. It would also intercept `.then` (the Vitest proxy mock problem documented in project memory).
4. **Bind-delegation:** Every method is explicitly listed, making the surface area auditable. Adding a method to `IStorage` without adding the bind delegation causes a compile error.

**The trade-off is boilerplate:** ~90 lines of `x = this._y.z.bind(this._y)` assignments. But this is intentional — it makes the "which domain class handles which method?" question answerable by reading one file.

**Hidden coupling via shared deps:** All 10 domain classes receive the same `{ db, cache }` dependency object. They share the same LRU cache instance, meaning cache invalidation in one domain (e.g., `architecture.replaceNodes()` invalidating `nodes:${projectId}`) can affect cache reads in another domain. This cross-domain cache coupling is invisible from the class interfaces.

**Testing benefit:** The barrel in `server/storage/index.ts` re-exports individual domain classes. Tests can instantiate `ProjectStorage` or `BomStorage` in isolation with mock deps, without instantiating the full `DatabaseStorage` facade.

---

Related:
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — StorageError is shared across all 10 domain classes via the common errors.ts module
- [[soft-deletes-create-a-persistent-querying-tax]] — the soft-delete filter appears in multiple domain classes independently, not centralized
