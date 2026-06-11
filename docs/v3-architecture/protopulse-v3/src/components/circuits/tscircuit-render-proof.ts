import React from 'react';
import { Circuit } from '@tscircuit/core';
import { TscircuitDraftSchema, type TscircuitDraft } from './tscircuit-contract';

export interface TscircuitRenderProof {
  status: 'rendered';
  circuitJsonCount: number;
  circuitJsonTypes: string[];
}

export async function renderTscircuitDraftProof(input: unknown): Promise<TscircuitRenderProof> {
  const draft = TscircuitDraftSchema.parse(input);
  const circuit = new Circuit();
  circuit.add(toReactCircuit(draft));
  await circuit.renderUntilSettled();
  const circuitJson = circuit.getCircuitJson() as Array<{ type?: string }>;

  return {
    status: 'rendered',
    circuitJsonCount: circuitJson.length,
    circuitJsonTypes: [...new Set(circuitJson.map((entry) => entry.type ?? 'unknown'))],
  };
}

function toReactCircuit(draft: TscircuitDraft): React.ReactElement {
  const board = draft.elements.find((element) => element.kind === 'board');
  const boardProps = board?.props ?? { width: '20mm', height: '20mm' };
  const children = draft.elements
    .filter((element) => element.kind !== 'board')
    .map((element, index) => toReactElement(element, index))
    .filter((element): element is React.ReactElement => Boolean(element));

  return React.createElement('board', boardProps, ...children);
}

function toReactElement(element: TscircuitDraft['elements'][number], index: number): React.ReactElement | undefined {
  if (element.kind === 'resistor') {
    return React.createElement('resistor', { key: index, name: element.name, ...element.props });
  }
  if (element.kind === 'capacitor') {
    return React.createElement('capacitor', { key: index, name: element.name, ...element.props });
  }
  if (element.kind === 'trace') {
    return React.createElement('trace', { key: index, ...element.props });
  }

  return undefined;
}
