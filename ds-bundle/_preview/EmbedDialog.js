"use strict";
var __dsPreview = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx3(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx3;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx3)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.ProtoPulse;
    }
  });

  // .design-sync/previews/EmbedDialog.tsx
  var EmbedDialog_exports = {};
  __export(EmbedDialog_exports, {
    ShareLargeBoard: () => ShareLargeBoard,
    ShareSchematic: () => ShareSchematic
  });
  init_define_import_meta_env();

  // client/src/components/ui/EmbedDialog.tsx
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim());

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.ProtoPulse;
  var ds_default = "default" in g ? g.default : g;

  // client/src/lib/embed-viewer.ts
  init_define_import_meta_env();
  var MAX_URL_LENGTH = 8e3;
  var COMPRESSION_THRESHOLD = 256;
  var DEFAULT_THEME = {
    dark: true,
    accentColor: "#00F0FF",
    showGrid: true,
    showLabels: true
  };
  function uint8ToBase64url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64urlToUint8(encoded) {
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  async function compressData(data) {
    if (typeof CompressionStream === "undefined") {
      return data;
    }
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = cs.readable.getReader();
    const chunks = [];
    let totalLength = 0;
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      totalLength += value.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  async function decompressData(data) {
    if (typeof DecompressionStream === "undefined") {
      return data;
    }
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    let totalLength = 0;
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      totalLength += value.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  var EmbedManager = class {
    origin;
    constructor(origin) {
      this.origin = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://protopulse.app");
    }
    // -------------------------------------------------------------------------
    // Serialization
    // -------------------------------------------------------------------------
    /** Serialize circuit data to compact JSON string */
    serialize(data) {
      return JSON.stringify({
        n: data.nodes.map((node) => ({
          i: node.id,
          t: node.type,
          l: node.label,
          x: node.x,
          y: node.y,
          ...node.rotation !== void 0 && node.rotation !== 0 ? { r: node.rotation } : {},
          ...node.properties && Object.keys(node.properties).length > 0 ? { p: node.properties } : {}
        })),
        w: data.wires.map((wire) => ({
          i: wire.id,
          n: wire.netId,
          pt: wire.points,
          ...wire.layer ? { ly: wire.layer } : {},
          ...wire.width !== void 0 && wire.width !== 1 ? { wd: wire.width } : {},
          ...wire.color ? { c: wire.color } : {},
          ...wire.wireType && wire.wireType !== "wire" ? { wt: wire.wireType } : {}
        })),
        t: data.nets.map((net) => ({
          i: net.id,
          nm: net.name,
          ...net.netType && net.netType !== "signal" ? { nt: net.netType } : {},
          ...net.voltage ? { v: net.voltage } : {},
          ...net.segments && net.segments.length > 0 ? { sg: net.segments } : {},
          ...net.labels && net.labels.length > 0 ? { lb: net.labels } : {},
          ...net.style && Object.keys(net.style).length > 0 ? { st: net.style } : {}
        })),
        ...data.metadata ? { m: data.metadata } : {}
      });
    }
    /** Deserialize compact JSON back to circuit data */
    deserialize(json) {
      const parsed = JSON.parse(json);
      return {
        nodes: parsed.n.map((node) => ({
          id: node.i,
          type: node.t,
          label: node.l,
          x: node.x,
          y: node.y,
          ...node.r !== void 0 ? { rotation: node.r } : {},
          ...node.p ? { properties: node.p } : {}
        })),
        wires: parsed.w.map((wire) => ({
          id: wire.i,
          netId: wire.n,
          points: wire.pt,
          ...wire.ly ? { layer: wire.ly } : {},
          ...wire.wd !== void 0 ? { width: wire.wd } : {},
          ...wire.c ? { color: wire.c } : {},
          ...wire.wt ? { wireType: wire.wt } : {}
        })),
        nets: parsed.t.map((net) => ({
          id: net.i,
          name: net.nm,
          ...net.nt ? { netType: net.nt } : {},
          ...net.v ? { voltage: net.v } : {},
          ...net.sg ? { segments: net.sg } : {},
          ...net.lb ? { labels: net.lb } : {},
          ...net.st ? { style: net.st } : {}
        })),
        ...parsed.m ? { metadata: parsed.m } : {}
      };
    }
    // -------------------------------------------------------------------------
    // Encode / Decode
    // -------------------------------------------------------------------------
    /** Encode circuit data to a URL-safe string. Prefix: 'c' = compressed, 'r' = raw */
    async encode(data) {
      const json = this.serialize(data);
      const raw = new TextEncoder().encode(json);
      if (raw.length < COMPRESSION_THRESHOLD) {
        return "r" + uint8ToBase64url(raw);
      }
      const compressed = await compressData(raw);
      if (compressed.length < raw.length) {
        return "c" + uint8ToBase64url(compressed);
      }
      return "r" + uint8ToBase64url(raw);
    }
    /** Decode a URL-safe string back to circuit data */
    async decode(encoded) {
      if (encoded.length === 0) {
        throw new Error("Empty embed data");
      }
      const prefix = encoded[0];
      const payload = encoded.slice(1);
      let bytes;
      if (prefix === "c") {
        const compressed = base64urlToUint8(payload);
        bytes = await decompressData(compressed);
      } else if (prefix === "r") {
        bytes = base64urlToUint8(payload);
      } else {
        throw new Error(`Unknown embed data prefix: ${prefix}`);
      }
      const json = new TextDecoder().decode(bytes);
      return this.deserialize(json);
    }
    // -------------------------------------------------------------------------
    // URL generation
    // -------------------------------------------------------------------------
    /** Build the embed URL for client-encoded data */
    getEmbedUrl(encodedData, theme) {
      let url = `${this.origin}/embed/${encodedData}`;
      const params = this.buildThemeParams(theme);
      if (params) {
        url += `?${params}`;
      }
      return url;
    }
    /** Build the short embed URL */
    getShortEmbedUrl(shortCode, theme) {
      let url = `${this.origin}/embed/s/${shortCode}`;
      const params = this.buildThemeParams(theme);
      if (params) {
        url += `?${params}`;
      }
      return url;
    }
    /** Check if the encoded data exceeds the URL length limit */
    exceedsUrlLimit(encodedData, theme) {
      const url = this.getEmbedUrl(encodedData, theme);
      return url.length > MAX_URL_LENGTH;
    }
    // -------------------------------------------------------------------------
    // Embed code generation
    // -------------------------------------------------------------------------
    /** Generate an iframe embed code */
    generateIframe(url, options) {
      const width = options?.width ?? "100%";
      const height = options?.height ?? "400";
      return `<iframe src="${url}" width="${width}" height="${height}" frameBorder="0" style="border:0;border-radius:8px;" allowfullscreen></iframe>`;
    }
    /** Generate a Markdown embed */
    generateMarkdown(url, title) {
      const label = title ?? "Circuit Schematic";
      const previewUrl = url.replace(/\/embed\//, "/embed/preview/") + ".png";
      return `[![${label}](${previewUrl})](${url})`;
    }
    /** Generate embed code in the specified format */
    generateEmbedCode(format, url, options) {
      switch (format) {
        case "iframe":
          return this.generateIframe(url, options);
        case "markdown":
          return this.generateMarkdown(url, options?.title);
        case "link":
          return url;
      }
    }
    // -------------------------------------------------------------------------
    // Theme helpers
    // -------------------------------------------------------------------------
    /** Merge partial theme with defaults */
    resolveTheme(partial) {
      return { ...DEFAULT_THEME, ...partial };
    }
    /** Parse theme from URL search params */
    parseThemeFromParams(params) {
      const theme = {};
      if (params.has("theme")) {
        theme.dark = params.get("theme") === "dark";
      }
      if (params.has("accent")) {
        theme.accentColor = params.get("accent") ?? DEFAULT_THEME.accentColor;
      }
      if (params.has("grid")) {
        theme.showGrid = params.get("grid") !== "false";
      }
      if (params.has("labels")) {
        theme.showLabels = params.get("labels") !== "false";
      }
      return theme;
    }
    // -------------------------------------------------------------------------
    // Server short URL
    // -------------------------------------------------------------------------
    /** Create a server-stored short URL */
    async createShortUrl(encodedData) {
      const res = await fetch("/api/embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: encodedData })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(body.message ?? `Failed to create short URL (${String(res.status)})`);
      }
      return res.json();
    }
    /** Fetch circuit data from a short code */
    async fetchShortUrl(code) {
      const res = await fetch(`/api/embeds/${code}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Embed not found or expired");
        }
        throw new Error(`Failed to fetch embed (${String(res.status)})`);
      }
      const body = await res.json();
      return body.data;
    }
    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    buildThemeParams(theme) {
      if (!theme) {
        return "";
      }
      const params = new URLSearchParams();
      if (theme.dark !== void 0) {
        params.set("theme", theme.dark ? "dark" : "light");
      }
      if (theme.accentColor !== void 0) {
        params.set("accent", theme.accentColor);
      }
      if (theme.showGrid !== void 0) {
        params.set("grid", String(theme.showGrid));
      }
      if (theme.showLabels !== void 0) {
        params.set("labels", String(theme.showLabels));
      }
      const str = params.toString();
      return str;
    }
  };

  // client/src/components/ui/EmbedDialog.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  var TABS = [
    { id: "link", label: "Link", icon: ds_exports.Link2 },
    { id: "iframe", label: "Embed Code", icon: ds_exports.Code2 },
    { id: "markdown", label: "Markdown", icon: ds_exports.FileText }
  ];
  function EmbedDialog({ open, onOpenChange, circuitData }) {
    const [activeTab, setActiveTab] = (0, import_react.useState)("link");
    const [copied, setCopied] = (0, import_react.useState)(false);
    const [encodedData, setEncodedData] = (0, import_react.useState)(null);
    const [shortCode, setShortCode] = (0, import_react.useState)(null);
    const [shortUrlLoading, setShortUrlLoading] = (0, import_react.useState)(false);
    const [shortUrlError, setShortUrlError] = (0, import_react.useState)(null);
    const [encoding, setEncoding] = (0, import_react.useState)(false);
    const [themeDark, setThemeDark] = (0, import_react.useState)(true);
    const [showGrid, setShowGrid] = (0, import_react.useState)(true);
    const [showLabels, setShowLabels] = (0, import_react.useState)(true);
    const manager = (0, import_react.useMemo)(() => new EmbedManager(), []);
    const themeOptions = (0, import_react.useMemo)(
      () => ({ dark: themeDark, showGrid, showLabels }),
      [themeDark, showGrid, showLabels]
    );
    (0, import_react.useEffect)(() => {
      if (!open) {
        return;
      }
      setEncoding(true);
      setEncodedData(null);
      setShortCode(null);
      setShortUrlError(null);
      manager.encode(circuitData).then((encoded) => {
        setEncodedData(encoded);
        setEncoding(false);
      }).catch(() => {
        setEncoding(false);
      });
    }, [open, circuitData, manager]);
    const needsShortUrl = (0, import_react.useMemo)(() => {
      if (!encodedData) {
        return false;
      }
      return manager.exceedsUrlLimit(encodedData, themeOptions);
    }, [encodedData, manager, themeOptions]);
    const embedUrl = (0, import_react.useMemo)(() => {
      if (shortCode) {
        return manager.getShortEmbedUrl(shortCode, themeOptions);
      }
      if (encodedData && !needsShortUrl) {
        return manager.getEmbedUrl(encodedData, themeOptions);
      }
      return null;
    }, [encodedData, shortCode, needsShortUrl, manager, themeOptions]);
    const embedCode = (0, import_react.useMemo)(() => {
      if (!embedUrl) {
        return "";
      }
      return manager.generateEmbedCode(activeTab, embedUrl, {
        title: circuitData.metadata?.name
      });
    }, [activeTab, embedUrl, manager, circuitData.metadata?.name]);
    const handleCreateShortUrl = (0, import_react.useCallback)(async () => {
      if (!encodedData) {
        return;
      }
      setShortUrlLoading(true);
      setShortUrlError(null);
      try {
        const result = await manager.createShortUrl(encodedData);
        setShortCode(result.code);
      } catch (err) {
        setShortUrlError(err instanceof Error ? err.message : "Failed to create short URL");
      } finally {
        setShortUrlLoading(false);
      }
    }, [encodedData, manager]);
    const handleCopy = (0, import_react.useCallback)(async () => {
      if (!embedCode) {
        return;
      }
      try {
        await navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2e3);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = embedCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2e3);
      }
    }, [embedCode]);
    (0, import_react.useEffect)(() => {
      if (!open) {
        return;
      }
      const handler = (e) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
      };
      window.addEventListener("keydown", handler);
      return () => {
        window.removeEventListener("keydown", handler);
      };
    }, [open, onOpenChange]);
    if (!open) {
      return null;
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        className: "fixed inset-0 z-50 flex items-center justify-center",
        "data-testid": "embed-dialog-overlay",
        onClick: (e) => {
          if (e.target === e.currentTarget) {
            onOpenChange(false);
          }
        },
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            onOpenChange(false);
          }
        },
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Share & Embed",
        tabIndex: -1,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-black/60" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              className: "relative bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4",
              "data-testid": "embed-dialog",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex items-center justify-between px-5 py-4 border-b border-border", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "text-base font-semibold text-foreground", "data-testid": "embed-dialog-title", children: "Share & Embed" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "button",
                    {
                      onClick: () => {
                        onOpenChange(false);
                      },
                      className: "text-muted-foreground hover:text-foreground transition-colors",
                      "data-testid": "embed-dialog-close",
                      "aria-label": "Close",
                      children: "×"
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex border-b border-border", "data-testid": "embed-tabs", children: TABS.map((tab) => {
                  const Icon = tab.icon;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                    "button",
                    {
                      onClick: () => {
                        setActiveTab(tab.id);
                      },
                      className: `flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${activeTab === tab.id ? "text-primary border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"}`,
                      "data-testid": `embed-tab-${tab.id}`,
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "w-3.5 h-3.5" }),
                        tab.label
                      ]
                    },
                    tab.id
                  );
                }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "p-5 space-y-4", children: [
                  encoding ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex items-center justify-center py-8", "data-testid": "embed-encoding", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Loader2, { className: "w-5 h-5 animate-spin text-primary" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-2 text-sm text-muted-foreground", children: "Encoding circuit data..." })
                  ] }) : needsShortUrl && !shortCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "space-y-3", "data-testid": "embed-needs-short-url", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-sm text-muted-foreground", children: "This circuit is too large for a URL-encoded link. Create a short URL to share it." }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        onClick: () => void handleCreateShortUrl(),
                        disabled: shortUrlLoading,
                        className: "flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50",
                        "data-testid": "embed-create-short-url",
                        children: shortUrlLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Loader2, { className: "w-4 h-4 animate-spin" }),
                          "Creating..."
                        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Link2, { className: "w-4 h-4" }),
                          "Create Short URL"
                        ] })
                      }
                    ),
                    shortUrlError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-sm text-destructive", "data-testid": "embed-short-url-error", children: shortUrlError })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "relative", "data-testid": "embed-code-container", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-40 text-foreground whitespace-pre-wrap break-all", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { "data-testid": "embed-code-output", children: embedCode }) }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          onClick: () => void handleCopy(),
                          className: "absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background transition-colors",
                          "data-testid": "embed-copy-button",
                          "aria-label": "Copy to clipboard",
                          children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Check, { className: "w-3.5 h-3.5 text-green-500" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Copy, { className: "w-3.5 h-3.5 text-muted-foreground" })
                        }
                      )
                    ] }),
                    !needsShortUrl && !shortCode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        onClick: () => void handleCreateShortUrl(),
                        disabled: shortUrlLoading,
                        className: "text-xs text-muted-foreground hover:text-foreground underline transition-colors",
                        "data-testid": "embed-optional-short-url",
                        children: shortUrlLoading ? "Creating short URL..." : "Create a shorter URL"
                      }
                    ),
                    shortCode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "text-xs text-muted-foreground", "data-testid": "embed-short-url-info", children: [
                      "Using short URL (code: ",
                      shortCode,
                      ") — expires in 30 days."
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "space-y-2 pt-2 border-t border-border", "data-testid": "embed-theme-options", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Theme Options" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-wrap gap-3", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "flex items-center gap-1.5 text-xs text-foreground cursor-pointer", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "input",
                          {
                            type: "checkbox",
                            checked: themeDark,
                            onChange: (e) => {
                              setThemeDark(e.target.checked);
                            },
                            className: "rounded",
                            "data-testid": "embed-theme-dark"
                          }
                        ),
                        "Dark mode"
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "flex items-center gap-1.5 text-xs text-foreground cursor-pointer", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "input",
                          {
                            type: "checkbox",
                            checked: showGrid,
                            onChange: (e) => {
                              setShowGrid(e.target.checked);
                            },
                            className: "rounded",
                            "data-testid": "embed-theme-grid"
                          }
                        ),
                        "Show grid"
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "flex items-center gap-1.5 text-xs text-foreground cursor-pointer", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "input",
                          {
                            type: "checkbox",
                            checked: showLabels,
                            onChange: (e) => {
                              setShowLabels(e.target.checked);
                            },
                            className: "rounded",
                            "data-testid": "embed-theme-labels"
                          }
                        ),
                        "Show labels"
                      ] })
                    ] })
                  ] })
                ] })
              ]
            }
          )
        ]
      }
    );
  }

  // .design-sync/previews/EmbedDialog.tsx
  var import_jsx_runtime2 = __toESM(require_react_shim(), 1);
  var Surface = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bg-background text-foreground", style: { padding: 24, minHeight: 480, position: "relative" }, children });
  var blinkCircuit = {
    nodes: [
      { id: "U1", type: "mcu", label: "ATmega328P-PU", x: 12e4, y: 8e4, rotation: 0 },
      { id: "R1", type: "resistor", label: "220Ω", x: 24e4, y: 8e4 },
      { id: "D1", type: "led", label: "LED (red)", x: 32e4, y: 8e4 }
    ],
    wires: [
      { id: 1, netId: 1, points: [], color: "#22c55e" },
      { id: 2, netId: 2, points: [], color: "#ef4444" }
    ],
    nets: [
      { id: 1, name: "PB5/D13", netType: "signal" },
      { id: 2, name: "GND", netType: "power", voltage: "0V" }
    ],
    metadata: {
      name: "ATmega Blink Demo",
      description: "Classic LED blink on digital pin 13 with a 220Ω series resistor.",
      version: 2
    }
  };
  function ShareSchematic() {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EmbedDialog, { open: true, circuitData: blinkCircuit, onOpenChange: () => {
    } }) });
  }
  function ShareLargeBoard() {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      EmbedDialog,
      {
        open: true,
        circuitData: {
          ...blinkCircuit,
          metadata: {
            name: "ESP32 Sensor Hub",
            description: "Multi-sensor board with I2C bus and 3V3 LDO regulator.",
            version: 5
          }
        },
        onOpenChange: () => {
        }
      }
    ) });
  }
  return __toCommonJS(EmbedDialog_exports);
})();
