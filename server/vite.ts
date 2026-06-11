import { type Express } from "express";
import { type Server } from "http";
import fs from "fs";
import path from "path";
import { createLogger, createServer as createViteServer } from "vite";
import viteConfig from "../vite.config";

const viteLogger = createLogger();

function readPort(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const port = Number.parseInt(value, 10);
  return Number.isFinite(port) && port > 0 ? port : undefined;
}

export function buildViteServerOptions(server: Server) {
  const appPort = readPort(process.env.PORT) ?? 5000;
  const hmrPort = readPort(process.env.VITE_HMR_PORT) ?? appPort + 20_000;
  const isPlaywrightServer = process.env.PLAYWRIGHT === "1";

  return {
    middlewareMode: true as const,
    // HMR websocket is unstable in this embedded middleware stack and can
    // cascade into repeated optimizer invalidations. Use full-page reloads in
    // normal dev, but give Playwright a unique websocket port so fresh test
    // servers can run beside an already-open local dev server.
    hmr: isPlaywrightServer
      ? {
          port: hmrPort,
          clientPort: hmrPort,
        }
      : false as const,
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
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
