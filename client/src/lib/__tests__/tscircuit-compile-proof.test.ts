import { describe, expect, it } from "vitest";

import { buildTSCircuitCompileProof } from "../tscircuit-compile-proof";

describe("tscircuit compile proof", () => {
  it("compiles a React circuit into real Circuit JSON", async () => {
    const proof = await buildTSCircuitCompileProof();

    expect(proof.summary.softwareUsed).toContain("@tscircuit/core");
    expect(proof.summary.elementCount).toBeGreaterThan(20);
    expect(proof.summary.componentNames).toEqual(expect.arrayContaining(["R1", "L1"]));
    expect(proof.summary.elementTypes).toEqual(
      expect.arrayContaining([
        "source_board",
        "source_component",
        "source_trace",
        "pcb_board",
        "pcb_component",
        "pcb_trace",
        "schematic_component",
        "schematic_trace",
      ]),
    );

    const sourceTraces = proof.circuitJson.filter((element) => element.type === "source_trace");
    const pcbTraces = proof.circuitJson.filter((element) => element.type === "pcb_trace");
    const schematicTraces = proof.circuitJson.filter((element) => element.type === "schematic_trace");

    expect(sourceTraces).toHaveLength(3);
    expect(pcbTraces.length).toBeGreaterThan(0);
    expect(schematicTraces).toHaveLength(3);
  }, 30_000);

  it("maps supported project instances into the tscircuit compile path", async () => {
    const proof = await buildTSCircuitCompileProof({
      instances: [
        {
          id: 10,
          referenceDesignator: "R10",
          schematicX: 1,
          schematicY: 2,
          pcbX: 3,
          pcbY: 4,
          properties: { value: "4.7k", footprint: "0603" },
        },
        {
          id: 11,
          referenceDesignator: "C1",
          schematicX: 5,
          schematicY: 6,
          pcbX: 7,
          pcbY: 8,
          properties: { capacitance: "100nF", package: "0805" },
        },
        {
          id: 12,
          referenceDesignator: "U1",
          properties: { value: "ATmega328P" },
        },
      ],
      boardWidth: "25mm",
      boardHeight: "20mm",
    });

    expect(proof.summary.inputMode).toBe("project-instances");
    expect(proof.summary.mappedInstanceCount).toBe(3);
    expect(proof.summary.mappedTraceCount).toBe(0);
    expect(proof.summary.componentNames).toEqual(expect.arrayContaining(["R10", "C1", "U1"]));
    expect(proof.summary.mappingWarnings).toEqual([]);
    expect(proof.circuitJson.filter((element) => element.type === "source_component")).toHaveLength(3);
  }, 30_000);

  it("maps supported project net segments into tscircuit traces", async () => {
    const proof = await buildTSCircuitCompileProof({
      instances: [
        { id: 1, referenceDesignator: "R1", properties: { value: "1k" } },
        { id: 2, referenceDesignator: "C1", properties: { value: "100nF" } },
        { id: 3, referenceDesignator: "U1", properties: { value: "controller" } },
      ],
      nets: [
        {
          id: 10,
          name: "FILTER",
          segments: [
            { fromInstanceId: 1, fromPin: "pin-1", toInstanceId: 2, toPin: "1" },
            { fromInstanceId: 1, fromPin: "pin-2", toInstanceId: 3, toPin: "VCC" },
          ],
        },
      ],
    });

    expect(proof.summary.inputMode).toBe("project-instances");
    expect(proof.summary.mappedInstanceCount).toBe(3);
    expect(proof.summary.mappedTraceCount).toBe(2);
    expect(proof.summary.mappingWarnings).toEqual(
      [],
    );
    expect(proof.circuitJson.filter((element) => element.type === "source_trace")).toHaveLength(2);
  }, 30_000);
});
