/**
 * "Missing component" rules — things commonly forgotten that a design really
 * ought to include (decoupling caps, flyback diodes, current-limiting
 * resistors, etc.). Ten rules.
 */

import { getElectronicsKnowledge } from '@shared/electronics-knowledge';

import { buildAdjacency, connectedNodes, makePrediction } from '../context';
import {
  ADC_PATTERNS,
  isCapacitor,
  isCrystal,
  isDiode,
  isHBridge,
  isLed,
  isMcu,
  isMotor,
  isRegulator,
  isRelay,
  isResistor,
  isSensor,
  isUsb,
  nodeMatches,
} from '../heuristics';
import type { Prediction, PredictionRule } from '../types';

export function makeMcuDecouplingCaps(): PredictionRule {
  const k = getElectronicsKnowledge('decoupling');
  return {
    id: 'mcu-decoupling-caps',
    name: 'MCU decoupling capacitors',
    category: 'missing_component',
    baseConfidence: 0.95,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isMcu).forEach((mcu) => {
        const neighbours = connectedNodes(mcu.id, adj, nodes);
        const hasCap = neighbours.some(isCapacitor);
        if (!hasCap) {
          preds.push(makePrediction(
            'mcu-decoupling-caps',
            `Add decoupling capacitors for ${mcu.label}`,
            `MCU "${mcu.label}" — ${k.explanation}`,
            0.95,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '100nF', near: mcu.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeMcuCrystal(): PredictionRule {
  return {
    id: 'mcu-crystal',
    name: 'MCU clock source',
    category: 'missing_component',
    baseConfidence: 0.80,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isMcu).forEach((mcu) => {
        const neighbours = connectedNodes(mcu.id, adj, nodes);
        const hasClock = neighbours.some(isCrystal);
        const allCrystals = nodes.some(isCrystal);
        if (!hasClock && !allCrystals) {
          preds.push(makePrediction(
            'mcu-crystal',
            `Add crystal/oscillator for ${mcu.label}`,
            'Most MCUs need an external crystal or oscillator for accurate timing. Internal RC oscillators are less precise and may not support USB or UART at higher baud rates.',
            0.80,
            'missing_component',
            { type: 'add_component', payload: { component: 'crystal', near: mcu.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeMotorFlybackDiode(): PredictionRule {
  const k = getElectronicsKnowledge('flyback-diode');
  return {
    id: 'motor-flyback-diode',
    name: 'Motor flyback diode',
    category: 'missing_component',
    baseConfidence: 0.93,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const inductiveLoads = nodes.filter((n) => isMotor(n) || isRelay(n));
      inductiveLoads.forEach((load) => {
        const neighbours = connectedNodes(load.id, adj, nodes);
        const hasDiode = neighbours.some(isDiode);
        if (!hasDiode) {
          preds.push(makePrediction(
            'motor-flyback-diode',
            `Add flyback diode for ${load.label}`,
            `Inductive load "${load.label}" — ${k.explanation}`,
            0.93,
            'missing_component',
            { type: 'add_component', payload: { component: 'diode', type: 'flyback', near: load.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeRegulatorCaps(): PredictionRule {
  return {
    id: 'regulator-caps',
    name: 'Voltage regulator capacitors',
    category: 'missing_component',
    baseConfidence: 0.92,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isRegulator).forEach((reg) => {
        const neighbours = connectedNodes(reg.id, adj, nodes);
        const capCount = neighbours.filter(isCapacitor).length;
        if (capCount < 2) {
          preds.push(makePrediction(
            'regulator-caps',
            `Add input/output capacitors for ${reg.label}`,
            `Voltage regulator "${reg.label}" needs an input capacitor (10 \u00B5F) and output capacitor (10 \u00B5F + 100 nF) for stability. Without them, the regulator may oscillate or produce noisy output.`,
            0.92,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '10uF+100nF', near: reg.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeIcBypassCap(): PredictionRule {
  return {
    id: 'ic-bypass-cap',
    name: 'IC bypass capacitor',
    category: 'missing_component',
    baseConfidence: 0.88,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const ics = nodes.filter((n) =>
        n.type === 'generic' && n.data?.description &&
        /\b(ic|chip|driver|amplifier|op-amp|comparator|timer|shift.register)\b/i.test(n.data.description) &&
        !isMcu(n) && !isRegulator(n),
      );
      ics.forEach((ic) => {
        const neighbours = connectedNodes(ic.id, adj, nodes);
        if (!neighbours.some(isCapacitor)) {
          preds.push(makePrediction(
            'ic-bypass-cap',
            `Add bypass capacitor for ${ic.label}`,
            `IC "${ic.label}" should have a 100 nF ceramic bypass capacitor between VCC and GND, placed as close to the chip as possible.`,
            0.88,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '100nF', near: ic.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeReversePolarity(): PredictionRule {
  return {
    id: 'reverse-polarity-protection',
    name: 'Reverse polarity protection',
    category: 'missing_component',
    baseConfidence: 0.85,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasPowerSource = nodes.some((n) => nodeMatches(n, ['battery', 'power-supply', 'barrel-jack', 'vin']));
      const hasProtection = nodes.some((n) => nodeMatches(n, ['reverse-polarity', 'p-mosfet', 'schottky']));
      if (hasPowerSource && !hasProtection) {
        preds.push(makePrediction(
          'reverse-polarity-protection',
          'Add reverse polarity protection',
          'Your design has an external power input but no reverse polarity protection. A series Schottky diode or P-channel MOSFET prevents damage if the power connector is wired backwards.',
          0.85,
          'missing_component',
          { type: 'add_component', payload: { component: 'diode', type: 'schottky' } },
        ));
      }
      return preds;
    },
  };
}

export function makeAdcReferenceVoltage(): PredictionRule {
  return {
    id: 'adc-reference-voltage',
    name: 'ADC reference voltage',
    category: 'missing_component',
    baseConfidence: 0.72,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasADC = nodes.some((n) => nodeMatches(n, ADC_PATTERNS) && !isMcu(n));
      const hasSensor = nodes.some(isSensor);
      const hasVref = nodes.some((n) => nodeMatches(n, ['reference', 'vref', 'voltage-reference']));
      if (hasADC && hasSensor && !hasVref) {
        preds.push(makePrediction(
          'adc-reference-voltage',
          'Add voltage reference for ADC',
          'Your design has an ADC reading sensor values. A precision voltage reference improves measurement accuracy compared to using the supply rail as reference.',
          0.72,
          'missing_component',
          { type: 'add_component', payload: { component: 'voltage-reference' } },
        ));
      }
      return preds;
    },
  };
}

export function makeLedResistor(): PredictionRule {
  return {
    id: 'led-current-resistor',
    name: 'LED current limiting resistor',
    category: 'missing_component',
    baseConfidence: 0.94,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isLed).forEach((led) => {
        const neighbours = connectedNodes(led.id, adj, nodes);
        const hasResistor = neighbours.some(isResistor);
        if (!hasResistor) {
          preds.push(makePrediction(
            'led-current-resistor',
            `Add current limiting resistor for ${led.label}`,
            `LED "${led.label}" needs a series resistor to limit current. Without it, the LED will draw too much current and burn out quickly. Typical values: 220\u03A9-1k\u03A9 for 3.3V/5V supplies.`,
            0.94,
            'missing_component',
            { type: 'add_component', payload: { component: 'resistor', value: '330R', near: led.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeHBridgeBootstrapCaps(): PredictionRule {
  return {
    id: 'hbridge-bootstrap-caps',
    name: 'H-bridge bootstrap capacitors',
    category: 'missing_component',
    baseConfidence: 0.82,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isHBridge).forEach((hb) => {
        const neighbours = connectedNodes(hb.id, adj, nodes);
        const capCount = neighbours.filter(isCapacitor).length;
        if (capCount < 1) {
          preds.push(makePrediction(
            'hbridge-bootstrap-caps',
            `Add bootstrap capacitors for ${hb.label}`,
            `H-bridge/motor driver "${hb.label}" typically requires bootstrap capacitors for the high-side drivers. Check the datasheet for recommended values (usually 100 nF-1 \u00B5F).`,
            0.82,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '100nF', near: hb.id } },
          ));
        }
      });
      return preds;
    },
  };
}

export function makeUsbEsdProtection(): PredictionRule {
  return {
    id: 'usb-esd-protection',
    name: 'USB ESD protection',
    category: 'missing_component',
    baseConfidence: 0.86,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isUsb).forEach((usb) => {
        const neighbours = connectedNodes(usb.id, adj, nodes);
        const hasTvs = neighbours.some((n) => nodeMatches(n, ['tvs', 'esd', 'protection']));
        if (!hasTvs) {
          preds.push(makePrediction(
            'usb-esd-protection',
            `Add ESD protection for ${usb.label}`,
            `USB connector "${usb.label}" is exposed to external connections and needs TVS diodes on the data lines. Components like USBLC6-2 or TPD2E001 protect against ESD damage.`,
            0.86,
            'missing_component',
            { type: 'add_component', payload: { component: 'tvs-diode', near: usb.id } },
          ));
        }
      });
      return preds;
    },
  };
}
