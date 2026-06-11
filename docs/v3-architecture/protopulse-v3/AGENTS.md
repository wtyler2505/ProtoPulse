# ProtoPulse v3 Agent Rules

This scaffold is for bounded EDA work. Agents may generate code, plans, and schema-backed objects, but they must not guess hardware facts.

## Hard Rules

- Do not invent dimensions, pinouts, footprints, colors, electrical ratings, or tolerances.
- Use verified ProtoPulse knowledge first.
- If a hardware fact is missing, return `needs_verification` instead of filling it in.
- Every generated circuit object must pass Zod validation before it is accepted.
- Every generated component must include provenance for the facts it uses.
- Firmware agents must state target board, voltage assumptions, and pin ownership.
- Swarm workers may edit only their claimed files.
- Swarm workers must produce machine-readable output and a short human summary.

## Allowed Outputs

- `verified`: backed by a local source or cited upstream source.
- `needs_verification`: missing or uncertain hardware fact.
- `blocked`: cannot proceed without a required fact or tool.

## Unsafe Outputs

- "Approximate" pinouts.
- Placeholder dimensions that look real.
- Silent fallback to a different board or package.
- Firmware that assigns pins without ownership proof.
