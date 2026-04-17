/**
 * TinkerCad Circuits Exporter
 *
 * Generates a JSON structure compatible with TinkerCad Circuits import.
 * Maps ProtoPulse components and nets to TinkerCad entities.
 */

import type {
  CircuitInstanceRow,
  CircuitNetRow,
  ComponentPart
} from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import type { NetSegment, NetStyle } from '@shared/circuit-types';

interface TinkerCadExportOptions {
  projectName: string;
  instances: CircuitInstanceRow[];
  nets: CircuitNetRow[];
  parts: ComponentPart[];
}

export async function generateTinkercadProject(opts: TinkerCadExportOptions) {
  const { projectName, instances, nets, parts } = opts;

  // TinkerCad Circuits uses a proprietary JSON format.
  // This is a best-effort approximation based on known schema.
  const exportData = {
    version: '1.0',
    app: 'TinkerCad Circuits',
    project: projectName,
    components: instances.map((inst) => {
      const part = parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Partial<PartMeta> & { type?: string };

      return {
        id: inst.referenceDesignator,
        type: meta.type || 'generic',
        name: meta.title || inst.referenceDesignator,
        position: {
          x: inst.breadboardX || 0,
          y: inst.breadboardY || 0
        },
        rotation: inst.breadboardRotation || 0,
        properties: inst.properties || {}
      };
    }),
    wires: nets.flatMap((net) => {
      const segments = (Array.isArray(net.segments) ? net.segments : []) as NetSegment[];
      const style = (net.style ?? {}) as NetStyle;
      return segments.map((seg, i) => ({
        id: `wire_${net.id}_${i}`,
        from: { component: `instance-${seg.fromInstanceId}`, pin: seg.fromPin },
        to: { component: `instance-${seg.toInstanceId}`, pin: seg.toPin },
        color: style.color || '#00FF00'
      }));
    })
  };

  return {
    content: JSON.stringify(exportData, null, 2),
    encoding: 'utf8' as const,
    mimeType: 'application/json',
    filename: `${projectName.replace(/\s+/g, '_')}_tinkercad.json`
  };
}
