import { z } from 'zod';

/**
 * Analysis configs — Vol II §D.1, honest v0.2 cut.
 *
 * Four classic SPICE analyses. Each config validates at the zod boundary
 * and emits exactly one analysis card; the engine wrapper appends the
 * card plus `.end` to a netlist body.
 */

const zFinite = z.number().finite();
const zPositive = zFinite.positive();

const analysisUnion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('op') }).strict(),
  z
    .object({
      kind: z.literal('tran'),
      /** Suggested output step, seconds. */
      stepS: zPositive,
      /** End of the transient window, seconds. */
      stopS: zPositive,
      /** Optional output start time, seconds. */
      startS: zFinite.nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('dc'),
      /** Name of the swept source element ("V1"). */
      source: z.string().min(1),
      start: zFinite,
      stop: zFinite,
      step: zFinite.refine((n) => n !== 0, { message: 'step must be nonzero' }),
    })
    .strict(),
  z
    .object({
      kind: z.literal('ac'),
      variation: z.enum(['dec', 'oct', 'lin']),
      /** Points per decade/octave, or total points for 'lin'. */
      points: z.number().int().positive(),
      fStart: zPositive,
      fStop: zPositive,
    })
    .strict(),
]);

export type Analysis = z.infer<typeof analysisUnion>;

export const analysisSchema: z.ZodType<Analysis> = analysisUnion.superRefine((a, ctx) => {
  if (a.kind === 'tran' && a.stopS <= (a.startS ?? 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stopS must exceed startS' });
  }
  if (a.kind === 'ac' && a.fStop < a.fStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fStop must be >= fStart' });
  }
});

/**
 * Compact deterministic SPICE number: exponential form when it is
 * clearly shorter than the plain decimal ("1e-6" not "0.000001"),
 * plain otherwise ("330", "0.1", "1000").
 */
export function spiceNum(n: number): string {
  // Normalize float artifacts (10 * 1e-6 → 9.999999999999999e-6).
  const clean = Number(n.toPrecision(12));
  const plain = String(clean);
  const exp = clean.toExponential().replace('e+', 'e');
  return exp.length + 1 < plain.length ? exp : plain;
}

/** Emit the SPICE analysis card for a config: '.tran 1e-6 1e-4'. */
export function analysisCard(a: Analysis): string {
  switch (a.kind) {
    case 'op':
      return '.op';
    case 'tran': {
      const base = `.tran ${spiceNum(a.stepS)} ${spiceNum(a.stopS)}`;
      return a.startS !== undefined ? `${base} ${spiceNum(a.startS)}` : base;
    }
    case 'dc':
      return `.dc ${a.source} ${spiceNum(a.start)} ${spiceNum(a.stop)} ${spiceNum(a.step)}`;
    case 'ac':
      return `.ac ${a.variation} ${String(a.points)} ${spiceNum(a.fStart)} ${spiceNum(a.fStop)}`;
  }
}
