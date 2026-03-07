/**
 * React hook for evaluating Circuit DSL code in a sandboxed Web Worker.
 *
 * - Creates a persistent worker on mount, terminates on unmount
 * - 2-second watchdog kills hung workers and recreates them
 * - Deduplication: new evaluations cancel in-flight ones via evalId tracking
 * - Sucrase transpiles TypeScript on the main thread
 * - Zod validates the IR result before accepting it
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CircuitIR } from './circuit-ir';
import {
  createCircuitWorker,
  evaluateInWorker,
  terminateWorker,
} from './circuit-dsl-worker';
import type { ComponentCatalogEntry } from './circuit-dsl-worker';

export interface EvalError {
  message: string;
  line?: number;
}

export interface UseCircuitEvaluatorResult {
  ir: CircuitIR | null;
  error: EvalError | null;
  isEvaluating: boolean;
  evaluate: (code: string, catalog?: ComponentCatalogEntry[]) => void;
}

/**
 * Hook that manages a sandboxed Web Worker for evaluating Circuit DSL code.
 */
export function useCircuitEvaluator(): UseCircuitEvaluatorResult {
  const [ir, setIr] = useState<CircuitIR | null>(null);
  const [error, setError] = useState<EvalError | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const currentEvalIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Create worker on mount
  useEffect(() => {
    mountedRef.current = true;
    workerRef.current = createCircuitWorker();

    return () => {
      mountedRef.current = false;
      if (workerRef.current) {
        terminateWorker(workerRef.current);
        workerRef.current = null;
      }
    };
  }, []);

  const evaluate = useCallback((code: string, catalog: ComponentCatalogEntry[] = []) => {
    // Cancel any in-flight evaluation by generating a new evalId
    const evalId = crypto.randomUUID();
    currentEvalIdRef.current = evalId;
    setIsEvaluating(true);
    setError(null);

    // Ensure we have a live worker
    if (!workerRef.current) {
      workerRef.current = createCircuitWorker();
    }

    const worker = workerRef.current;

    evaluateInWorker(worker, code, catalog).then((result) => {
      // Ignore stale results from cancelled evaluations
      if (!mountedRef.current || currentEvalIdRef.current !== evalId) {
        return;
      }

      setIsEvaluating(false);

      if (result.ok) {
        setIr(result.ir);
        setError(null);
      } else {
        setIr(null);
        setError({
          message: result.error,
          line: result.line,
        });
      }
    }).catch((err: unknown) => {
      if (!mountedRef.current || currentEvalIdRef.current !== evalId) {
        return;
      }

      setIsEvaluating(false);
      setIr(null);
      setError({
        message: err instanceof Error ? err.message : String(err),
      });

      // Recreate worker after unexpected errors
      if (workerRef.current) {
        terminateWorker(workerRef.current);
      }
      workerRef.current = createCircuitWorker();
    });
  }, []);

  return { ir, error, isEvaluating, evaluate };
}
