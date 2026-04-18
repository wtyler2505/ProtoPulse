/**
 * Safety rules — high-priority warnings for designs that risk fire, shock,
 * ESD damage, or thermal runaway. Six rules.
 */

import { buildAdjacency, connectedNodes, makePrediction } from '../context';
import {
  isBattery,
  isConnector,
  isFuse,
  isHBridge,
  isHeatsink,
  isHighVoltage,
  isMainsVoltage,
  isMcu,
  isMotor,
  isOptocoupler,
  isRegulator,
  isSensor,
  isTransistor,
  nodeMatches,
} from '../heuristics';
import type { Prediction, PredictionRule } from '../types';

export function makeMainsFuse(): PredictionRule {
  return {
    id: 'mains-fuse',
    name: 'Mains fuse and varistor',
    category: 'safety',
    baseConfidence: 0.97,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isMainsVoltage)) {
        if (!nodes.some(isFuse)) {
          preds.push(makePrediction(
            'mains-fuse',
            'Add fuse and varistor for mains input',
            'Your design connects to mains voltage. A fuse is MANDATORY for safety, and a varistor (MOV) protects against voltage surges. This is a safety requirement, not optional.',
            0.97,
            'safety',
            { type: 'add_component', payload: { component: 'fuse', type: 'mains' } },
          ));
        }
      }
      return preds;
    },
  };
}

export function makeBatteryProtection(): PredictionRule {
  return {
    id: 'battery-protection',
    name: 'Battery protection circuit',
    category: 'safety',
    baseConfidence: 0.91,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isBattery)) {
        const hasProtection = nodes.some((n) => nodeMatches(n, ['bms', 'battery-protection', 'undervoltage', 'overcurrent', 'charge-controller']));
        if (!hasProtection) {
          preds.push(makePrediction(
            'battery-protection',
            'Add battery protection circuit',
            'Battery-powered designs need protection against overcurrent, undervoltage, and overcharge. A BMS (Battery Management System) or protection IC prevents battery damage and fire risk.',
            0.91,
            'safety',
            { type: 'add_component', payload: { component: 'battery-protection' } },
          ));
        }
      }
      return preds;
    },
  };
}

export function makeMotorCurrentSensing(): PredictionRule {
  return {
    id: 'motor-current-sensing',
    name: 'Motor current sensing',
    category: 'safety',
    baseConfidence: 0.76,
    check(nodes) {
      const preds: Prediction[] = [];
      const motors = nodes.filter(isMotor);
      if (motors.length > 0) {
        const hasSensing = nodes.some((n) => nodeMatches(n, ['current-sense', 'shunt', 'ina219', 'acs712']));
        if (!hasSensing) {
          preds.push(makePrediction(
            'motor-current-sensing',
            'Add current sensing for motors',
            'Motors can stall and draw excessive current, damaging drivers and wiring. A current sense resistor or IC (like INA219) lets your MCU detect overcurrent and shut down safely.',
            0.76,
            'safety',
            { type: 'add_component', payload: { component: 'current-sense' } },
          ));
        }
      }
      return preds;
    },
  };
}

export function makeHighVoltageIsolation(): PredictionRule {
  return {
    id: 'high-voltage-isolation',
    name: 'High voltage isolation',
    category: 'safety',
    baseConfidence: 0.90,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasHV = nodes.some(isHighVoltage) || nodes.some(isMainsVoltage);
      const hasLowVoltage = nodes.some(isMcu) || nodes.some(isSensor);
      if (hasHV && hasLowVoltage) {
        const hasIsolation = nodes.some(isOptocoupler) || nodes.some((n) => nodeMatches(n, ['isolation', 'isolated', 'galvanic']));
        if (!hasIsolation) {
          preds.push(makePrediction(
            'high-voltage-isolation',
            'Add galvanic isolation',
            'Your design mixes high and low voltage sections. An optocoupler or digital isolator between them protects the low-voltage side (and you!) from dangerous voltages.',
            0.90,
            'safety',
            { type: 'add_component', payload: { component: 'optocoupler' } },
          ));
        }
      }
      return preds;
    },
  };
}

export function makeConnectorEsdProtection(): PredictionRule {
  return {
    id: 'connector-esd-protection',
    name: 'Connector ESD protection',
    category: 'safety',
    baseConfidence: 0.78,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const exposedConnectors = nodes.filter(isConnector);
      if (exposedConnectors.length > 0) {
        const anyProtected = exposedConnectors.some((conn) => {
          const neighbours = connectedNodes(conn.id, adj, nodes);
          return neighbours.some((n) => nodeMatches(n, ['tvs', 'esd', 'protection']));
        });
        if (!anyProtected) {
          preds.push(makePrediction(
            'connector-esd-protection',
            'Add ESD protection on external connectors',
            'Exposed connectors are entry points for ESD damage. TVS diode arrays on signal lines protect sensitive ICs from electrostatic discharge during handling and use.',
            0.78,
            'safety',
            { type: 'add_component', payload: { component: 'tvs-diode-array' } },
          ));
        }
      }
      return preds;
    },
  };
}

export function makeThermalManagement(): PredictionRule {
  return {
    id: 'thermal-management',
    name: 'Thermal management',
    category: 'safety',
    baseConfidence: 0.73,
    check(nodes) {
      const preds: Prediction[] = [];
      const powerComponents = nodes.filter((n) => isRegulator(n) || isHBridge(n) || isTransistor(n));
      if (powerComponents.length > 0) {
        const hasHeatsink = nodes.some(isHeatsink);
        if (!hasHeatsink) {
          preds.push(makePrediction(
            'thermal-management',
            'Add thermal management for power components',
            'Power regulators, motor drivers, and transistors generate heat. Without adequate thermal management (heatsinks, thermal vias, copper pours), they may overheat and shut down or fail.',
            0.73,
            'safety',
            { type: 'show_info', payload: { topic: 'thermal-design' } },
          ));
        }
      }
      return preds;
    },
  };
}
