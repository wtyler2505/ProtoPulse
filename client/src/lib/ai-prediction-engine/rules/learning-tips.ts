/**
 * Learning-tip rules — surface didactic explanations when the design
 * contains a component category the tip applies to. Four rules.
 */

import { makePrediction } from '../context';
import { isCapacitor, isRegulator, isTransistor } from '../heuristics';
import type { Prediction, PredictionRule } from '../types';

export function makeTipDatasheets(): PredictionRule {
  return {
    id: 'tip-datasheets',
    name: 'Learn to read datasheets',
    category: 'learning_tip',
    baseConfidence: 0.50,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.length >= 1 && nodes.length <= 3) {
        preds.push(makePrediction(
          'tip-datasheets',
          'Tip: How to read component datasheets',
          'Every component has a datasheet with electrical specs, pin diagrams, and application circuits. Start with the "Absolute Maximum Ratings" and "Typical Application" sections \u2014 they tell you the limits and a proven reference design.',
          0.50,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'reading-datasheets' } },
        ));
      }
      return preds;
    },
  };
}

export function makeTipDropoutVoltage(): PredictionRule {
  return {
    id: 'tip-dropout-voltage',
    name: 'Learn about dropout voltage',
    category: 'learning_tip',
    baseConfidence: 0.55,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isRegulator)) {
        preds.push(makePrediction(
          'tip-dropout-voltage',
          'Tip: Understand dropout voltage',
          'A voltage regulator needs the input voltage to be higher than the output by at least the "dropout voltage." An LDO dropping 5V to 3.3V with 0.3V dropout needs at least 3.6V input. If the margin is too small, the output will sag.',
          0.55,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'dropout-voltage' } },
        ));
      }
      return preds;
    },
  };
}

export function makeTipDecouplingWhy(): PredictionRule {
  return {
    id: 'tip-decoupling-why',
    name: 'Why decoupling capacitors matter',
    category: 'learning_tip',
    baseConfidence: 0.52,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isCapacitor)) {
        preds.push(makePrediction(
          'tip-decoupling-why',
          'Tip: Why decoupling capacitors matter',
          'ICs switch millions of times per second, causing tiny current spikes on the power rail. A 100 nF ceramic cap acts as a local energy reserve, supplying current instantly and keeping the voltage stable. Place them as close to the IC as physically possible.',
          0.52,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'decoupling-capacitors' } },
        ));
      }
      return preds;
    },
  };
}

export function makeTipBaseResistor(): PredictionRule {
  return {
    id: 'tip-base-resistor',
    name: 'Transistor base resistor calculation',
    category: 'learning_tip',
    baseConfidence: 0.53,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isTransistor)) {
        preds.push(makePrediction(
          'tip-base-resistor',
          'Tip: Calculating base/gate resistors',
          'For a BJT transistor, the base resistor limits current into the base. Formula: R = (V_drive - 0.7V) / I_base. For switching, aim for I_base = I_collector / 10 (forced saturation). For MOSFETs, a gate resistor (10-100\u03A9) limits ringing.',
          0.53,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'transistor-biasing' } },
        ));
      }
      return preds;
    },
  };
}
