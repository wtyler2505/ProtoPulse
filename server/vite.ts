import { type Express } from "express";
import { type Server } from "http";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";
import { createLogger, createServer as createViteServer } from "vite";
import viteConfig from "../vite.config";

const viteLogger = createLogger();

export function buildViteServerOptions(server: Server) {
  return {
    middlewareMode: true as const,
    hmr: {
      server,
      protocol: "ws" as const,
      // Force the runtime fallback branch in Vite's client so the websocket
      // uses the page hostname (127.0.0.1 vs localhost) instead of baking in a
      // single host string that can break dev QA on alternate loopback names.
      host: "",
      clientPort: 5000,
      path: "/vite-hmr",
    },
    allowedHosts: true as const,
  };
}

export async function setupVite(server: Server, app: Express) {
  const serverOptions = buildViteServerOptions(server);

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
