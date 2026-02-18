import type { PartState, ComponentValidationIssue } from '@shared/component-types';
import { nanoid } from 'nanoid';

export function validatePart(state: PartState): ComponentValidationIssue[] {
  const issues: ComponentValidationIssue[] = [];

  if (!state.meta.title || state.meta.title.trim() === '') {
    issues.push({ id: nanoid(), severity: 'error', message: 'Part title is required', suggestion: 'Add a descriptive title in the Metadata tab' });
  }
  if (!state.meta.description || state.meta.description.trim() === '') {
    issues.push({ id: nanoid(), severity: 'warning', message: 'Part description is empty', suggestion: 'Add a description to help users understand this component' });
  }
  if (state.meta.tags.length === 0) {
    issues.push({ id: nanoid(), severity: 'info', message: 'No tags defined', suggestion: 'Add tags to make the part easier to find' });
  }
  if (!state.meta.mountingType) {
    issues.push({ id: nanoid(), severity: 'warning', message: 'Mounting type not specified', suggestion: 'Set THT or SMD in the Metadata tab' });
  }

  if (state.connectors.length === 0) {
    issues.push({ id: nanoid(), severity: 'error', message: 'No pins/connectors defined', suggestion: 'Add at least one pin in the Pin Table tab' });
  }

  const connectorNames = state.connectors.map(c => c.name);
  const duplicateNames = connectorNames.filter((name, i) => connectorNames.indexOf(name) !== i);
  if (duplicateNames.length > 0) {
    issues.push({ id: nanoid(), severity: 'error', message: `Duplicate pin names: ${Array.from(new Set(duplicateNames)).join(', ')}`, suggestion: 'Each pin must have a unique name' });
  }

  for (const conn of state.connectors) {
    if (!conn.name || conn.name.trim() === '') {
      issues.push({ id: nanoid(), severity: 'error', message: `Connector ${conn.id} has no name`, elementId: conn.id, suggestion: 'Give every pin a name' });
    }
  }

  const views = ['breadboard', 'schematic', 'pcb'] as const;
  for (const view of views) {
    const viewData = state.views[view];
    if (viewData.shapes.length === 0) {
      issues.push({ id: nanoid(), severity: 'warning', message: `${view.charAt(0).toUpperCase() + view.slice(1)} view has no shapes`, view, suggestion: `Draw shapes in the ${view} view` });
    }
  }

  for (const conn of state.connectors) {
    const hasPosition = Object.keys(conn.terminalPositions).length > 0;
    if (!hasPosition) {
      issues.push({ id: nanoid(), severity: 'warning', message: `Pin "${conn.name}" has no terminal positions`, elementId: conn.id, suggestion: 'Place the pin on the canvas using the pin tool' });
    }
  }

  for (const view of views) {
    const shapes = state.views[view].shapes;
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        if (shapes[i].x === shapes[j].x && shapes[i].y === shapes[j].y && shapes[i].width === shapes[j].width && shapes[i].height === shapes[j].height) {
          issues.push({ id: nanoid(), severity: 'info', message: `Two shapes overlap exactly in ${view} view`, view, elementId: shapes[i].id, suggestion: 'Check if these are duplicate shapes' });
        }
      }
    }
  }

  return issues;
}
