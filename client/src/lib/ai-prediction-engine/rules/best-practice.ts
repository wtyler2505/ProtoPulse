/**
 * "Best practice" rules — design-quality nudges (power indicators, ferrite
 * beads, trace width, test points, mounting holes, etc.). Eight rules.
 */

import { buildAdjacency, connectedNodes, makePrediction } from '../context';
import {
  isBattery,
  isCapacitor,
  isFilter,
  isGround,
  isInductor,
  isLed,
  isMcu,
  isMotor,
  isMounting,
  isPowerIndicator,
  isRegulator,
  isResistor,
  isSensor,
  isTestPoint,
  nodeMatches,
} from '../heuristics';
import type { Prediction, PredictionRule } from '../types';

export function makePowerIndicator(): PredictionRule {
  return {
    id: 'power-indicator',
    name: 'Power indicator LED',
    category: 'best_practice',
    baseConfidence: 0.70,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasPower = nodes.some((n) => isRegulator(n) || isBattery(n) || nodeMatches(n, ['power-supply', 'vin']));
      const hasIndicator = nodes.some(isPowerIndicator) || nodes.some((n) => isLed(n) && nodeMatches(n, ['power', 'pwr', 'status']));
      if (hasPower && !hasIndicator && nodes.length > 2) {
        preds.push(makePrediction(
          'power-indicator',
          'Add a power indicator LED',
          'A simple LED with a series resistor on the power rail gives you instant visual feedback that the board is powered. This is one of the easiest debugging aids you can add.',
          0.70,
          'best_practice',
          { type: 'add_component', payload: { component: 'led', label: 'Power LED' } },
        ));
      }
      return preds;
    },
  };
}

export function makeFerriteBeadSharedPower(): PredictionRule {
  return {
    id: 'ferrite-bead-shared-power',
    name: 'Ferrite bead for shared power rail',
    category: 'best_practice',
    baseConfidence: 0.65,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const ics = nodes.filter((n) => isMcu(n) || nodeMatches(n, ['ic', 'chip', 'driver']));
      if (ics.length >= 3) {
        const hasFerrite = nodes.some(isInductor) || nodes.some((n) => nodeMatches(n, ['ferrite']));
        if (!hasFerrite) {
          const shared = ics.some((ic) => {
            const neighbours = connectedNodes(ic.id, adj, nodes);
            return neighbours.some((nb) => ics.includes(nb));
          });
          if (shared || ics.length >= 3) {
            preds.push(makePrediction(
              'ferrite-bead-shared-power',
              'Add ferrite bead between digital/analog power',
              'With multiple ICs sharing a power rail, a ferrite bead between digital and analog sections reduces high-frequency noise coupling. Place it on the VCC trace feeding sensitive analog components.',
              0.65,
              'best_practice',
              { type: 'add_component', payload: { component: 'ferrite-bead' } },
            ));
          }
        }
      }
      return preds;
    },
  };
}

export function makeHighCurrentTraces(): PredictionRule {
  return {
    id: 'high-current-traces',
    name: 'High-current trace width',
    category: 'best_practice',
    baseConfidence: 0.75,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasMotor = nodes.some(isMotor);
      const hasHighPower = nodes.some((n) => nodeMatches(n, ['high-current', 'power-stage', 'h-bridge']));
      if (hasMotor || hasHighPower) {
        preds.push(makePrediction(
          'high-current-traces',
          'Use wider traces for high-current paths',
          'Motors and power stages draw significant current. Standard 6-mil traces can only handle ~0.5A. Use 20-50 mil traces or copper pours for power paths to prevent overheating.',
          0.75,
          'best_practice',
          { type: 'show_info', payload: { topic: 'trace-width-calculator' } },
        ));
      }
      return preds;
    },
  };
}

export function makeSwitchingRegulatorInductor(): PredictionRule {
  return {
    id: 'switching-regulator-inductor',
    name: 'Switching regulator inductor',
    category: 'best_practice',
    baseConfidence: 0.78,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const switchingRegs = nodes.filter((n) => nodeMatches(n, ['buck', 'boost', 'switching']));
      switchingRegs.forEach((reg) => {
        const neighbours = connectedNodes(reg.id, adj, nodes);
        if (!neighbours.some(isInductor)) {
          preds.push(makePrediction(
            'switching-regulator-inductor',
            `Verify inductor selection for ${reg.label}`,
            `Switching regulator "${reg.label}" requires a properly rated inductor. Select based on the datasheet-recommended inductance, saturation current (\u22651.3\u00D7 max load), and DC resistance.`,
            0.78,
            'best_practice',
            { type: 'show_info', payload: { topic: 'inductor-selection', near: reg.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeSensorFiltering(): PredictionRule {
  return {
    id: 'sensor-filtering',
    name: 'Sensor signal filtering',
    category: 'best_practice',
    baseConfidence: 0.68,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isSensor).forEach((sensor) => {
        const neighbours = connectedNodes(sensor.id, adj, nodes);
        const hasFilter = neighbours.some(isFilter) || neighbours.some((n) => isCapacitor(n) && isResistor(n));
        if (!hasFilter) {
          preds.push(makePrediction(
            'sensor-filtering',
            `Add filtering for ${sensor.label}`,
            `Sensor "${sensor.label}" output may contain noise. An RC low-pass filter (resistor + capacitor) on the signal line cleans up the reading before it reaches the ADC.`,
            0.68,
            'best_practice',
            { type: 'add_component', payload: { component: 'rc-filter', near: sensor.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeStarGrounding(): PredictionRule {
  return {
    id: 'star-grounding',
    name: 'Star grounding topology',
    category: 'best_practice',
    baseConfidence: 0.60,
    check(nodes) {
      const preds: Prediction[] = [];
      const grounds = nodes.filter(isGround);
      if (grounds.length > 2) {
        preds.push(makePrediction(
          'star-grounding',
          'Consider star grounding topology',
          'Multiple ground connections can create ground loops. Route all ground returns to a single star point to minimize noise from current flowing through shared ground paths.',
          0.60,
          'best_practice',
          { type: 'show_info', payload: { topic: 'star-grounding' } },
        ));
      }
      return preds;
    },
  };
}

export function makeTestPoints(): PredictionRule {
  return {
    id: 'no-test-points',
    name: 'Add test points',
    category: 'best_practice',
    baseConfidence: 0.65,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.length >= 5 && !nodes.some(isTestPoint)) {
        preds.push(makePrediction(
          'no-test-points',
          'Add test points for debugging',
          'Your design has no test points. Adding test pads on key signals (power rails, data buses, clock) makes debugging with a multimeter or oscilloscope much easier.',
          0.65,
          'best_practice',
          { type: 'add_component', payload: { component: 'test-point' } },
        ));
      }
      return preds;
    },
  };
}

export function makeMountingHoles(): PredictionRule {
  return {
    id: 'no-mounting-holes',
    name: 'Add mounting holes',
    category: 'best_practice',
    baseConfidence: 0.62,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.length >= 5 && !nodes.some(isMounting)) {
        preds.push(makePrediction(
          'no-mounting-holes',
          'Add mounting holes to your board',
          'Your design has no mounting holes. Adding 4 M3 mounting holes at the corners allows you to securely fasten the PCB in an enclosure or onto standoffs.',
          0.62,
          'best_practice',
          { type: 'add_component', payload: { component: 'mounting-hole', count: 4 } },
        ));
      }
      return preds;
    },
  };
}
