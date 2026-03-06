import type { Express } from 'express';
import { asyncHandler, parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { storage } from '../storage';
import { generateStep } from '../export/step-generator';
import type { StepInput } from '../export/step-generator';

export function registerExportStepRoutes(app: Express): void {
  app.post('/api/projects/:id/export/step', requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const project = await storage.getProject(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const designs = await storage.getCircuitDesigns(projectId);
    const design = designs[0];

    let components: StepInput['components'] = [];
    const vias: StepInput['vias'] = [];

    if (design) {
      const instances = await storage.getCircuitInstances(design.id);
      components = instances.map((inst) => {
        const props = (inst.properties ?? {}) as Record<string, unknown>;
        return {
          refDes: inst.referenceDesignator ?? `U${inst.id}`,
          packageType: (props.packageType as string) ?? 'SOIC-8',
          x: inst.pcbX ?? 0,
          y: inst.pcbY ?? 0,
          rotation: inst.pcbRotation ?? 0,
          side: ((inst.pcbSide ?? 'front') === 'back' ? 'back' : 'front') as 'front' | 'back',
          bodyWidth: (props.bodyWidth as number) ?? 0,
          bodyHeight: (props.bodyHeight as number) ?? 0,
          bodyDepth: (props.bodyDepth as number) ?? 0,
        };
      });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const boardWidth = typeof body.boardWidth === 'number' ? body.boardWidth : 100;
    const boardHeight = typeof body.boardHeight === 'number' ? body.boardHeight : 80;
    const boardThickness = typeof body.boardThickness === 'number' ? body.boardThickness : 1.6;

    const input: StepInput = {
      projectName: project.name,
      board: { width: boardWidth, height: boardHeight, thickness: boardThickness },
      components,
      vias,
    };

    const result = generateStep(input);

    res.setHeader('Content-Type', 'application/step');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }));
}
