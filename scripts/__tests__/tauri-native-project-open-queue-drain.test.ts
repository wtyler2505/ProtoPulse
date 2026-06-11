import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const nativeProjectOpenPath = resolve(repoRoot, "src-tauri", "src", "native_project_open.rs");
const src = readFileSync(nativeProjectOpenPath, "utf8");

describe("native_project_open queue-drain contract", () => {
  it("defines enqueue + drain helpers used by frontend_ready flow", () => {
    expect(src.includes("fn enqueue_pending(")).toBe(true);
    expect(src.includes("fn mark_frontend_ready_and_drain(")).toBe(true);
    expect(src.includes("mark_frontend_ready_and_drain(state.inner())")).toBe(true);
  });

  it("includes focused cold-start queue drain test", () => {
    expect(src.includes("cold_start_requests_queue_then_drain_once_frontend_is_ready")).toBe(true);
    expect(src.includes('assert_eq!(drained[0].source, "cold-start")')).toBe(true);
    expect(src.includes('assert_eq!(drained[1].source, "deep-link")')).toBe(true);
    expect(src.includes("drained_again.is_empty()")).toBe(true);
  });
});
