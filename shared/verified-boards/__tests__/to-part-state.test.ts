import { describe, expect, it } from 'vitest';

import { boardDefinitionToPartState } from '../to-part-state';
import { ARDUINO_UNO_R3 } from '../arduino-uno-r3';

describe('boardDefinitionToPartState', () => {
  it('preserves real bench geometry and pin anchors for off-breadboard verified boards', () => {
    const state = boardDefinitionToPartState(ARDUINO_UNO_R3);
    const breadboardShapes = state.views.breadboard.shapes;
    const body = breadboardShapes.find((shape) => shape.id === 'bb-body');
    const powerPin = state.connectors.find((connector) => connector.name === '5V');
    const digitalPin = state.connectors.find((connector) => connector.name === '13');

    expect(body).toBeDefined();
    expect(body?.type).toBe('rect');
    expect(body?.width).toBeGreaterThan(140);
    expect(body?.height).toBeGreaterThan(100);

    expect(powerPin?.terminalPositions.breadboard).toBeDefined();
    expect(digitalPin?.terminalPositions.breadboard).toBeDefined();
    expect(powerPin?.shapeIds.breadboard).toContain('conn-5V-bb');
    expect(digitalPin?.shapeIds.breadboard).toContain('conn-D13-bb');

    expect(powerPin?.terminalPositions.breadboard.x).not.toEqual(digitalPin?.terminalPositions.breadboard.x);
    expect(powerPin?.terminalPositions.breadboard.y).not.toEqual(digitalPin?.terminalPositions.breadboard.y);
  });
});
