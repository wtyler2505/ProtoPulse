import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  // Required for packaged WebView builds so asset URLs resolve relative to
  // bundled index.html instead of assuming an absolute server root.
  base: "./",
  plugins: [
    react(),
    // Filter out errors that originate from user browser extensions
    // (Grammarly, LanguageTool, Microsoft Editor, etc.) rather than our code.
    runtimeErrorOverlay({
      filter: (error) => {
        const message = error.message ?? "";
        const stack = error.stack ?? "";
        const extensionSignals = [
          "mce-autosize-textarea",
          "A listener indicated an asynchronous response",
          "message channel closed before a response",
          "webcomponents-ce.js",
          "overlay_bundle.js",
          "chrome-extension://",
          "moz-extension://",
        ];
        return !extensionSignals.some(
          (signal) => message.includes(signal) || stack.includes(signal),
        );
      },
    }),
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
      // Patched Radix Slot to fix React 19 infinite-loop bug.
      // See client/src/vendor/radix-slot-fixed.tsx for details.
      "@radix-ui/react-slot": path.resolve(
        import.meta.dirname,
        "client",
        "src",
        "vendor",
        "radix-slot-fixed.tsx",
      ),
    },
  },
  optimizeDeps: {
    // Force re-bundling so any cached pre-bundled chunks that still contain
    // the original composeRefs path get rebuilt against the alias.
    force: true,
    exclude: ["@radix-ui/react-slot"],
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
            // Only chunk truly universal dependencies needed on every page load.
            // Everything else (xyflow, recharts, codemirror, markdown, etc.) is
            // used in specific lazy-loaded views and should be split naturally by
            // Vite's dynamic import analysis for proper tree-shaking.
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
              return 'react-vendor';
            }
          }
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
