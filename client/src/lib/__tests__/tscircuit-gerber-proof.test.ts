import { describe, expect, it } from "vitest";

import { buildTSCircuitGerberProof } from "../tscircuit-gerber-proof";

describe("tscircuit gerber proof", () => {
  it("exports compiled Circuit JSON into Gerber layer text", async () => {
    const proof = await buildTSCircuitGerberProof();

    expect(proof.circuitJsonElementCount).toBeGreaterThan(20);
    expect(proof.summary.hasCopperLayer).toBe(true);
    expect(proof.summary.hasBoardOutline).toBe(true);
    expect(proof.summary.totalGerberBytes).toBeGreaterThan(1_000);
    expect(proof.summary.gerberFileNames).toEqual(
      expect.arrayContaining(["F_Cu", "F_Mask", "F_Paste", "F_SilkScreen", "Edge_Cuts"]),
    );

    expect(proof.gerberFiles.F_Cu).toContain("%TF.GenerationSoftware");
    expect(proof.gerberFiles.F_Cu).toContain("%TF.FileFunction,Copper");
    expect(proof.gerberFiles.Edge_Cuts).toContain("%TF.FileFunction,Profile");
  }, 30_000);

  it("exports supported project instances through the Gerber proof path", async () => {
    const proof = await buildTSCircuitGerberProof({
      instances: [
        { id: 1, referenceDesignator: "R2", properties: { value: "1k" } },
        { id: 2, referenceDesignator: "LED1", properties: { footprint: "0603" } },
        { id: 3, referenceDesignator: "U2", properties: { value: "logic" } },
      ],
      boardWidth: "30mm",
      boardHeight: "20mm",
    });

    expect(proof.summary.inputMode).toBe("project-instances");
    expect(proof.summary.mappedInstanceCount).toBe(3);
    expect(proof.summary.mappedTraceCount).toBe(0);
    expect(proof.summary.mappingWarnings).toEqual([]);
    expect(proof.summary.hasCopperLayer).toBe(true);
    expect(proof.summary.hasBoardOutline).toBe(true);
  }, 30_000);

  it("carries mapped project traces into the Gerber proof summary", async () => {
    const proof = await buildTSCircuitGerberProof({
      instances: [
        { id: 1, referenceDesignator: "R1", properties: { value: "1k" } },
        { id: 2, referenceDesignator: "C1", properties: { value: "100nF" } },
      ],
      nets: [
        {
          id: 5,
          name: "RC",
          segments: [{ fromInstanceId: 1, fromPin: "1", toInstanceId: 2, toPin: "pin-1" }],
        },
      ],
    });

    expect(proof.summary.inputMode).toBe("project-instances");
    expect(proof.summary.mappedInstanceCount).toBe(2);
    expect(proof.summary.mappedTraceCount).toBe(1);
    expect(proof.summary.mappingWarnings).toEqual([]);
    expect(proof.summary.hasCopperLayer).toBe(true);
  }, 30_000);
});
