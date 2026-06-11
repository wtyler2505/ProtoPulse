/**
 * Phase 3 Task 3.3 reconciliation inbox note exists.
 *
 * The pp-core notebook source `62a2e851` (2026-03-13) recommends "server with
 * offline cache" for project storage. The Tauri Path C pivot supersedes that
 * for project data (native FS) but preserves it for shared catalog content.
 *
 * This test ensures the reconciliation note exists in `inbox/` so the
 * Ars Contexta `/extract` pipeline can promote it to `knowledge/` and the
 * pp-core notebook's "stale recommendation vs current direction" gap is
 * surfaced for downstream consumers.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const inboxPath = resolve(
  __dirname,
  "..",
  "..",
  "inbox",
  "tauri-storage-reconciliation-2026-05-10.md",
);

describe("Phase 3 Task 3.3 reconciliation note (inbox/)", () => {
  it("inbox note exists", () => {
    expect(
      existsSync(inboxPath),
      `Phase 3.3 requires inbox/tauri-storage-reconciliation-2026-05-10.md — captures the supersession of pp-core source 62a2e851 by the Path C pivot. Route through /extract to knowledge/ in a later pipeline step.`,
    ).toBe(true);
  });

  it("inbox note references pp-core source 62a2e851 explicitly", () => {
    if (!existsSync(inboxPath)) return;
    const body = readFileSync(inboxPath, "utf8");
    expect(body.includes("62a2e851")).toBe(true);
  });

  it("inbox note names the Path C topology ADR", () => {
    if (!existsSync(inboxPath)) return;
    const body = readFileSync(inboxPath, "utf8");
    expect(
      body.includes("2026-05-10-adr-tauri-runtime-topology") ||
        body.includes("Path C"),
    ).toBe(true);
  });
});
