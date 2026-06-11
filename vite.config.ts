import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  // Required for packaged WebView builds so asset URLs resolve relative to
  // bundled index.html instead of assuming an absolute server root.
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
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
    // CRITICAL for 3D View: ensure a SINGLE `three` instance across manual imports
    // and @react-three/fiber + drei. Without this we get the "Multiple instances of Three.js"
    // warning, broken materials, double Clock, and massive performance cliffs in the R3F overlay.
    dedupe: ['three'],
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
    // ProtoPulse intentionally ships heavy CAD/workbench surfaces (Schematic/tldraw,
    // Three/R3F, CodeMirror, React DOM) behind lazy routes. Keep a real budget above
    // the current largest route chunk instead of treating Vite's 500 kB app default
    // as a false-positive warning for this hardware design workspace.
    chunkSizeWarningLimit: 1500,
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
