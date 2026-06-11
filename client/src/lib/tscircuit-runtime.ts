export type TSCircuitRuntimeStatus = 'loading' | 'ready' | 'unavailable';

export interface TSCircuitRuntimeProbe {
  status: Exclude<TSCircuitRuntimeStatus, 'loading'>;
  source: string;
  reason?: string;
}

const CANDIDATE_IMPORTS = [
  'tscircuit',
  '@tscircuit/core',
];

export async function probeTSCircuitRuntime(): Promise<TSCircuitRuntimeProbe> {
  for (const source of CANDIDATE_IMPORTS) {
    try {
      const mod = await import(
        /* @vite-ignore */ source
      );
      if (mod) {
        return { status: 'ready', source };
      }
    } catch (error) {
      // Try the next candidate package.
      const reason = error instanceof Error ? error.message : 'unknown import error';
      if (source === CANDIDATE_IMPORTS[CANDIDATE_IMPORTS.length - 1]) {
        return { status: 'unavailable', source, reason };
      }
    }
  }
  return { status: 'unavailable', source: CANDIDATE_IMPORTS[CANDIDATE_IMPORTS.length - 1], reason: 'no candidate imports' };
}

