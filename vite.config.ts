import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // React core runtime (react, react-dom, scheduler)
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
              return 'react-vendor';
            }
            // @xyflow
            if (id.includes('/@xyflow/')) {
              return 'xyflow-vendor';
            }
            // TanStack Query (not virtual — virtual goes with ChatPanel)
            if (id.includes('/@tanstack/react-query') || id.includes('/@tanstack/query-core')) {
              return 'tanstack-vendor';
            }
            // Lucide icons
            if (id.includes('/lucide-react/')) {
              return 'ui-icons';
            }
            // Radix UI
            if (id.includes('/@radix-ui/')) {
              return 'radix-vendor';
            }
            // Markdown rendering
            if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/rehype-')
              || id.includes('/unified/') || id.includes('/unist-') || id.includes('/mdast-')
              || id.includes('/hast-') || id.includes('/micromark') || id.includes('/vfile')) {
              return 'markdown-vendor';
            }
            // Charts
            if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-')) {
              return 'charts-vendor';
            }
            // Drag and drop
            if (id.includes('/@dnd-kit/')) {
              return 'dnd-vendor';
            }
            // Tailwind merge — large utility, isolate to own chunk
            if (id.includes('/tailwind-merge/')) {
              return 'tailwind-merge-vendor';
            }
            // cmdk — command palette dependency
            if (id.includes('/cmdk/')) {
              return 'cmdk-vendor';
            }
          }
          // Let Rollup handle everything else with automatic chunking
          return undefined;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
