import type { SnapTarget } from '@/lib/component-editor/snap-engine';

interface SnapGuidesProps {
  guides: SnapTarget[];
}

export default function SnapGuides({ guides }: SnapGuidesProps) {
  if (guides.length === 0) return null;
  return (
    <g data-testid="snap-guides">
      {guides.map((g, i) => (
        g.axis === 'x' ? (
          <line key={i} x1={g.value} y1={-10000} x2={g.value} y2={10000}
            stroke="#00F0FF" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.6} pointerEvents="none" />
        ) : (
          <line key={i} x1={-10000} y1={g.value} x2={10000} y2={g.value}
            stroke="#00F0FF" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.6} pointerEvents="none" />
        )
      ))}
    </g>
  );
}
