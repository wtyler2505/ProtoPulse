import React from "react";

type CircuitElement = {
  type: string;
  [key: string]: unknown;
};

type TSCircuitCore = {
  Circuit: new () => {
    add: (element: React.ReactElement) => void;
    renderUntilSettled?: () => Promise<void>;
    getCircuitJson: () => unknown[];
  };
};

export type TSCircuitCompileProof = {
  circuitJson: CircuitElement[];
  summary: {
    elementCount: number;
    elementTypes: string[];
    componentNames: string[];
    softwareUsed: string | null;
    inputMode: "proof-circuit" | "project-instances";
    mappedInstanceCount: number;
    mappedTraceCount: number;
    mappingWarnings: string[];
  };
};

const TSCIRCUIT_CORE_SPECIFIER = "@tscircuit/core";

async function loadTSCircuitCore(): Promise<TSCircuitCore> {
  return (await import(/* @vite-ignore */ TSCIRCUIT_CORE_SPECIFIER)) as unknown as TSCircuitCore;
}

export type TSCircuitExportInstance = {
  id?: number | string;
  referenceDesignator: string;
  schematicX?: number | null;
  schematicY?: number | null;
  pcbX?: number | null;
  pcbY?: number | null;
  properties?: unknown;
};

export type TSCircuitCompileInput = {
  instances?: TSCircuitExportInstance[];
  nets?: TSCircuitExportNet[];
  boardWidth?: string;
  boardHeight?: string;
};

export type TSCircuitExportNet = {
  id?: number | string;
  name: string;
  netType?: string | null;
  segments?: unknown;
};

type TSCircuitNetSegment = {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
};

type MappedInstance = {
  elementType: "resistor" | "capacitor" | "led" | "chip";
  props: Record<string, unknown>;
};

function readProperties(properties: unknown): Record<string, unknown> {
  return properties && typeof properties === "object" ? properties as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function coordinate(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePinSelector(pin: string): string {
  const trimmed = pin.trim();
  if (/^\d+$/.test(trimmed)) {
    return `pin${trimmed}`;
  }
  if (/^pin-\d+$/i.test(trimmed)) {
    return trimmed.replace(/^pin-/i, "pin");
  }
  return trimmed.replace(/[^A-Za-z0-9_]/g, "_");
}

function mapInstanceToTSCircuit(
  instance: TSCircuitExportInstance,
  index: number,
): { mapped?: MappedInstance; warning?: string } {
  const ref = instance.referenceDesignator.trim();
  const props = readProperties(instance.properties);
  const footprint = asString(props.footprint) ?? asString(props.package) ?? "0402";
  const commonProps = {
    name: ref,
    footprint,
    schX: coordinate(instance.schematicX, index * 2),
    schY: coordinate(instance.schematicY, 0),
    pcbX: coordinate(instance.pcbX, index * 3),
    pcbY: coordinate(instance.pcbY, 0),
  };

  if (/^R\d*/i.test(ref)) {
    return {
      mapped: {
        elementType: "resistor",
        props: {
          ...commonProps,
          resistance: asString(props.resistance) ?? asString(props.value) ?? "10k",
        },
      },
    };
  }

  if (/^C\d*/i.test(ref)) {
    return {
      mapped: {
        elementType: "capacitor",
        props: {
          ...commonProps,
          capacitance: asString(props.capacitance) ?? asString(props.value) ?? "1000pF",
        },
      },
    };
  }

  if (/^(LED|L)\d*/i.test(ref)) {
    return {
      mapped: {
        elementType: "led",
        props: commonProps,
      },
    };
  }

  if (/^(U|IC|J|P|CONN)\d*/i.test(ref)) {
    const isConnector = /^(J|P|CONN)\d*/i.test(ref);
    return {
      mapped: {
        elementType: "chip",
        props: {
          ...commonProps,
          pinLabels: isConnector
            ? { pin1: "pin1", pin2: "pin2" }
            : { pin1: "VCC", pin2: "GND", pin3: "IO1", pin4: "IO2", pin5: "pin5", pin6: "pin6", pin7: "pin7", pin8: "pin8" },
          manufacturerPartNumber: asString(props.manufacturerPartNumber) ?? asString(props.partNumber) ?? asString(props.value),
        },
      },
    };
  }

  return {
    warning: `${ref || `instance-${String(instance.id ?? index)}`} skipped: no tscircuit component mapper yet`,
  };
}

function buildProofCircuitChildren(): React.ReactElement[] {
  return [
    React.createElement("resistor", {
      name: "R1",
      resistance: "10k",
      footprint: "0402",
      schX: 0,
      schY: 0,
      pcbX: 0,
      pcbY: 0,
    }),
    React.createElement("led", {
      name: "L1",
      footprint: "0402",
      schX: 2,
      schY: 0,
      pcbX: 3,
      pcbY: 0,
    }),
    React.createElement("trace", { from: "R1.pin1", to: "net.VCC" }),
    React.createElement("trace", { from: "R1.pin2", to: "L1.pos" }),
    React.createElement("trace", { from: "L1.neg", to: "net.GND" }),
  ];
}

function buildProjectInstanceChildren(instances: TSCircuitExportInstance[]): {
  children: React.ReactElement[];
  mappedInstanceCount: number;
  refDesByInstanceId: Map<number, string>;
  mappingWarnings: string[];
} {
  const mappingWarnings: string[] = [];
  const refDesByInstanceId = new Map<number, string>();
  const children = instances.flatMap((instance, index) => {
    const result = mapInstanceToTSCircuit(instance, index);
    if (result.warning) {
      mappingWarnings.push(result.warning);
    }
    if (!result.mapped) {
      return [];
    }
    if (typeof instance.id === "number") {
      refDesByInstanceId.set(instance.id, result.mapped.props.name as string);
    }
    return React.createElement(result.mapped.elementType, {
      ...result.mapped.props,
    });
  });

  return {
    children,
    mappedInstanceCount: children.length,
    refDesByInstanceId,
    mappingWarnings,
  };
}

function isTSCircuitNetSegment(value: unknown): value is TSCircuitNetSegment {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<TSCircuitNetSegment>;
  return typeof candidate.fromInstanceId === "number"
    && typeof candidate.toInstanceId === "number"
    && typeof candidate.fromPin === "string"
    && typeof candidate.toPin === "string"
    && candidate.fromPin.trim().length > 0
    && candidate.toPin.trim().length > 0;
}

function buildProjectNetTraceChildren(
  nets: TSCircuitExportNet[],
  refDesByInstanceId: Map<number, string>,
): {
  children: React.ReactElement[];
  mappedTraceCount: number;
  mappingWarnings: string[];
} {
  const mappingWarnings: string[] = [];
  const children: React.ReactElement[] = [];

  for (const net of nets) {
    const segments = Array.isArray(net.segments) ? net.segments : [];
    for (const [index, segment] of segments.entries()) {
      if (!isTSCircuitNetSegment(segment)) {
        mappingWarnings.push(`${net.name} segment ${String(index + 1)} skipped: unsupported segment shape`);
        continue;
      }

      const fromRef = refDesByInstanceId.get(segment.fromInstanceId);
      const toRef = refDesByInstanceId.get(segment.toInstanceId);
      if (!fromRef || !toRef) {
        mappingWarnings.push(
          `${net.name} segment ${String(index + 1)} skipped: endpoint instance is not mapped to tscircuit`,
        );
        continue;
      }

      children.push(
        React.createElement("trace", {
          from: `${fromRef}.${normalizePinSelector(segment.fromPin)}`,
          to: `${toRef}.${normalizePinSelector(segment.toPin)}`,
        }),
      );
    }
  }

  return {
    children,
    mappedTraceCount: children.length,
    mappingWarnings,
  };
}

export async function buildTSCircuitCompileProof(
  input: TSCircuitCompileInput = {},
): Promise<TSCircuitCompileProof> {
  const { Circuit } = await loadTSCircuitCore();
  const circuit = new Circuit();
  const hasProjectInstances = (input.instances?.length ?? 0) > 0;
  const mappedProject = hasProjectInstances
    ? buildProjectInstanceChildren(input.instances ?? [])
    : { children: [], mappedInstanceCount: 0, refDesByInstanceId: new Map<number, string>(), mappingWarnings: [] };
  const useProjectInstances = mappedProject.children.length > 0;
  const mappedNetTraces = useProjectInstances
    ? buildProjectNetTraceChildren(input.nets ?? [], mappedProject.refDesByInstanceId)
    : { children: [], mappedTraceCount: 0, mappingWarnings: [] };
  const children = useProjectInstances
    ? mappedProject.children.concat(mappedNetTraces.children)
    : buildProofCircuitChildren();
  const mappingWarnings = useProjectInstances
    ? mappedProject.mappingWarnings.concat(mappedNetTraces.mappingWarnings)
    : mappedProject.mappingWarnings.concat(
      hasProjectInstances ? "No supported project instances mapped; used proof circuit fallback." : [],
    );

  circuit.add(
    React.createElement(
      "board",
      { width: input.boardWidth ?? "10mm", height: input.boardHeight ?? "10mm" },
      ...children,
    ),
  );

  if (typeof circuit.renderUntilSettled === "function") {
    await circuit.renderUntilSettled();
  }

  const circuitJson = circuit.getCircuitJson() as CircuitElement[];
  const elementTypes = [...new Set(circuitJson.map((element) => element.type))].sort();
  const componentNames = circuitJson
    .filter((element) => typeof element.name === "string")
    .map((element) => element.name as string)
    .sort();
  const softwareUsed =
    (circuitJson.find((element) => element.type === "source_project_metadata")
      ?.software_used_string as string | undefined) ?? null;

  return {
    circuitJson,
    summary: {
      elementCount: circuitJson.length,
      elementTypes,
      componentNames,
      softwareUsed,
      inputMode: useProjectInstances ? "project-instances" : "proof-circuit",
      mappedInstanceCount: useProjectInstances ? mappedProject.mappedInstanceCount : 0,
      mappedTraceCount: useProjectInstances ? mappedNetTraces.mappedTraceCount : 0,
      mappingWarnings,
    },
  };
}
