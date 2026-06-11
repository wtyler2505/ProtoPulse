/**
 * Desktop API routing contract (Phase 1 Task 1.2).
 *
 * Validates that selected frontend workflows route through `getDesktopAPI()`
 * when running inside Tauri (`isTauri === true`) and fall back to browser
 * behavior otherwise. Per Path C topology, the bridge is the reversible
 * boundary — adding a workflow here lets the browser/web mode keep working
 * while desktop mode picks up native primitives.
 *
 * First caller set audited from `client/src` (2026-05-10):
 *   - client/src/lib/csv.ts        :: downloadBlob() — chokepoint for CSV/text exports
 *
 * Subsequent tasks should add more callers (serial-logger, chat export,
 * project save/load, etc.) using the same routing pattern.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Module under test imports tauri-api, which we mock to drive isTauri.
// Keep the mock minimal so non-routing tests don't get false positives.
const apiMock = {
  isTauri: false,
  desktopAPI: null as {
    platform: string;
    openExternal: ReturnType<typeof vi.fn>;
    showSaveDialog: ReturnType<typeof vi.fn>;
    showOpenDialog: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    spawnProcess: ReturnType<typeof vi.fn>;
    getVersion: ReturnType<typeof vi.fn>;
    getPlatform: ReturnType<typeof vi.fn>;
    onMenuAction: ReturnType<typeof vi.fn>;
  } | null,
};

vi.mock("@/lib/tauri-api", () => ({
  get isTauri() {
    return apiMock.isTauri;
  },
  getDesktopAPI: () => apiMock.desktopAPI,
}));

import { downloadBlob } from "@/lib/csv";

function makeStubbedDesktopAPI() {
  return {
    platform: "linux",
    openExternal: vi.fn(),
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    spawnProcess: vi.fn(),
    getVersion: vi.fn(),
    getPlatform: vi.fn(),
    onMenuAction: vi.fn(() => () => {}),
  };
}

describe("downloadBlob() routing — browser fallback (isTauri=false)", () => {
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;
  let anchorClickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiMock.isTauri = false;
    apiMock.desktopAPI = null;

    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:stubbed-url");
    URL.revokeObjectURL = vi.fn();

    anchorClickSpy = vi.fn();
    // Spy on document.createElement to capture the anchor and its .click()
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const a = {
          href: undefined as string | undefined,
          download: undefined as string | undefined,
          click: anchorClickSpy as unknown as () => void,
        };
        return a as unknown as HTMLAnchorElement;
      }
      // Delegate other tags to the real implementation via the actual document method
      return document.implementation
        .createHTMLDocument()
        .createElement(tag);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it("uses the browser anchor-click download path when isTauri is false", async () => {
    const blob = new Blob(["a,b\n1,2\n"], { type: "text/csv" });
    await downloadBlob(blob, "data.csv");

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe("downloadBlob() routing — desktop path (isTauri=true)", () => {
  let originalCreate: typeof URL.createObjectURL;
  let anchorClickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiMock.isTauri = true;
    apiMock.desktopAPI = makeStubbedDesktopAPI();

    originalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:should-not-be-called");

    anchorClickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const a = {
          href: undefined as string | undefined,
          download: undefined as string | undefined,
          click: anchorClickSpy as unknown as () => void,
        };
        return a as unknown as HTMLAnchorElement;
      }
      return document.implementation
        .createHTMLDocument()
        .createElement(tag);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    vi.restoreAllMocks();
  });

  it("routes through DesktopAPI.showSaveDialog + writeFile when user picks a path", async () => {
    const api = apiMock.desktopAPI!;
    api.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: "/home/user/Documents/data.csv",
    });
    api.writeFile.mockResolvedValue(undefined);

    const blob = new Blob(["a,b\n1,2\n"], { type: "text/csv" });
    await downloadBlob(blob, "data.csv");

    expect(api.showSaveDialog).toHaveBeenCalledTimes(1);
    expect(api.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "data.csv" }),
    );
    expect(api.writeFile).toHaveBeenCalledTimes(1);
    expect(api.writeFile).toHaveBeenCalledWith(
      "/home/user/Documents/data.csv",
      expect.any(String),
    );

    // Confirm the browser path was NOT triggered.
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });

  it("no-ops when the user cancels the save dialog (no writeFile call)", async () => {
    const api = apiMock.desktopAPI!;
    api.showSaveDialog.mockResolvedValue({
      canceled: true,
      filePath: undefined,
    });

    const blob = new Blob(["a"], { type: "text/csv" });
    await downloadBlob(blob, "data.csv");

    expect(api.showSaveDialog).toHaveBeenCalledTimes(1);
    expect(api.writeFile).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });

  it("falls back to the browser anchor path if DesktopAPI is null even when isTauri is true (defensive)", async () => {
    // Defensive case: isTauri can be true but getDesktopAPI() returned null
    // (e.g., during init race). Ensure the workflow still completes via browser path.
    apiMock.desktopAPI = null;

    const blob = new Blob(["a"], { type: "text/csv" });
    await downloadBlob(blob, "data.csv");

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });
});
