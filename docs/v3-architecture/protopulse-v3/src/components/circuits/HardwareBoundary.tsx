import type { CompiledCircuitNode } from './SchematicCompiler';

interface HardwareBoundaryProps {
  node: CompiledCircuitNode;
}

export function HardwareBoundary({ node }: HardwareBoundaryProps) {
  return (
    <section data-status={node.status}>
      <h2>{node.label}</h2>
      <p>{node.status}</p>
    </section>
  );
}
