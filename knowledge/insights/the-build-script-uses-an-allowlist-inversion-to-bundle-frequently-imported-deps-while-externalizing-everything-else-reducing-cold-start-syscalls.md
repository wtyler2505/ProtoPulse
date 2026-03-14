---
summary: The esbuild server bundling strategy inverts the typical external list — it allowlists 34 deps to bundle (reducing openat syscalls) and externalizes everything else, optimizing for cold start time rather than bundle size
category: architecture
areas:
  - conventions
  - dependencies
---

# The build script uses an allowlist inversion to bundle frequently-imported deps while externalizing everything else, reducing cold start syscalls

`script/build.ts` implements a non-obvious bundling strategy for the server build:

```typescript
const allowlist = [
  "@anthropic-ai/sdk", "@google/genai", "axios", "express",
  "drizzle-orm", "zod", "pg", "ws", /* ... 34 total */
];
const allDeps = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
const externals = allDeps.filter((dep) => !allowlist.includes(dep));
```

Instead of the standard pattern of listing externals explicitly (the typical `external: ['pg', 'sharp']` approach), the script reads ALL dependencies from package.json, then subtracts the allowlist to compute externals. This means:

- **Allowlisted deps (34)** are bundled INTO `dist/index.cjs` — their code is inlined, eliminating node_modules file lookups at runtime
- **Everything else** stays external — loaded from node_modules at runtime via `require()`

The explicit comment explains the motivation: "server deps to bundle to reduce openat(2) syscalls which helps cold start times." Each unbundled dependency triggers multiple filesystem syscalls (openat, stat, readlink) as Node.js resolves the module graph. Bundling the most-imported deps eliminates these syscalls.

**The inversion matters for maintenance:** When a new dependency is added to package.json, it is automatically externalized (safe default). Only explicitly allowlisted deps get bundled. This prevents accidental bundling of native modules or deps with side effects that break when bundled.

The output is CJS format (`format: "cjs"`, `outfile: "dist/index.cjs"`) with production minification and `NODE_ENV` defined at build time. The Vite client build runs first, then esbuild handles the server — two different bundlers for two different targets.

Areas: [[conventions]], [[dependencies]]
