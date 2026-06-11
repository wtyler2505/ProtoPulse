import {
  buildTSCircuitCompileProof,
  type TSCircuitCompileInput,
} from "./tscircuit-compile-proof";

type GerberConverter = {
  convertSoupToExcellonDrillCommandLayers: (input: {
    circuitJson: unknown[];
    flip_y_axis?: boolean;
  }) => Record<string, unknown[]>;
  convertSoupToGerberCommands: (circuitJson: unknown[]) => unknown;
  stringifyExcellonDrill: (commands: unknown[]) => string;
  stringifyGerberCommandLayers: (commands: unknown) => Record<string, string>;
};

export type TSCircuitGerberProof = {
  circuitJsonElementCount: number;
  gerberFiles: Record<string, string>;
  drillFiles: Record<string, string>;
  summary: {
    gerberFileNames: string[];
    drillFileNames: string[];
    totalGerberBytes: number;
    hasCopperLayer: boolean;
    hasBoardOutline: boolean;
    inputMode: "proof-circuit" | "project-instances";
    mappedInstanceCount: number;
    mappedTraceCount: number;
    mappingWarnings: string[];
  };
};

const GERBER_CONVERTER_SPECIFIER = "circuit-json-to-gerber";

async function loadGerberConverter(): Promise<GerberConverter> {
  return (await import(/* @vite-ignore */ GERBER_CONVERTER_SPECIFIER)) as unknown as GerberConverter;
}

export async function buildTSCircuitGerberProof(
  input: TSCircuitCompileInput = {},
): Promise<TSCircuitGerberProof> {
  const [compileProof, converter] = await Promise.all([
    buildTSCircuitCompileProof(input),
    loadGerberConverter(),
  ]);
  const { circuitJson } = compileProof;

  const gerberCommands = converter.convertSoupToGerberCommands(circuitJson);
  const gerberFiles = converter.stringifyGerberCommandLayers(gerberCommands);
  const drillCommandLayers = converter.convertSoupToExcellonDrillCommandLayers({ circuitJson });
  const drillFiles = Object.fromEntries(
    Object.entries(drillCommandLayers).map(([fileName, commands]) => [
      fileName,
      converter.stringifyExcellonDrill(commands),
    ]),
  );
  const gerberFileNames = Object.keys(gerberFiles).sort();
  const drillFileNames = Object.keys(drillFiles).sort();

  return {
    circuitJsonElementCount: circuitJson.length,
    gerberFiles,
    drillFiles,
    summary: {
      gerberFileNames,
      drillFileNames,
      totalGerberBytes: Object.values(gerberFiles).reduce((total, file) => total + file.length, 0),
      hasCopperLayer: gerberFileNames.some((fileName) => fileName.endsWith("_Cu")),
      hasBoardOutline: gerberFileNames.includes("Edge_Cuts"),
      inputMode: compileProof.summary.inputMode,
      mappedInstanceCount: compileProof.summary.mappedInstanceCount,
      mappedTraceCount: compileProof.summary.mappedTraceCount,
      mappingWarnings: compileProof.summary.mappingWarnings,
    },
  };
}
