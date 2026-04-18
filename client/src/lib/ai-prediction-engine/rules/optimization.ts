/**
 * Optimization rules — BOM consolidation, supplier diversification, and
 * circuit simplification nudges. Four rules.
 */

import { buildAdjacency, makePrediction } from '../context';
import {
  isCapacitor,
  isDiode,
  isMcu,
  isResistor,
  isTransistor,
} from '../heuristics';
import type { Prediction, PredictionRule } from '../types';

export function makeDuplicateResistorValues(): PredictionRule {
  return {
    id: 'duplicate-resistor-values',
    name: 'Consolidate resistor values',
    category: 'optimization',
    baseConfidence: 0.60,
    check(_nodes, _edges, bom) {
      const preds: Prediction[] = [];
      const resistors = bom.filter((b) => /resistor|res|ohm|\u03A9/i.test(b.description));
      if (resistors.length >= 4) {
        const uniqueValues = new Set(resistors.map((r) => r.description.toLowerCase().trim()));
        if (uniqueValues.size >= 4) {
          preds.push(makePrediction(
            'duplicate-resistor-values',
            'Consolidate resistor values',
            `Your BOM has ${uniqueValues.size} different resistor values. Consider standardizing on fewer values (e.g., E12 series) to reduce unique part count and simplify procurement.`,
            0.60,
            'optimization',
            { type: 'open_view', payload: { view: 'bom' } },
          ));
        }
      }
      return preds;
    },
  };
}

export function makeSingleSourceRisk(): PredictionRule {
  return {
    id: 'single-source-risk',
    name: 'Single-source component risk',
    category: 'optimization',
    baseConfidence: 0.67,
    check(_nodes, _edges, bom) {
      const preds: Prediction[] = [];
      const byManufacturer = new Map<string, number>();
      bom.forEach((item) => {
        if (item.manufacturer) {
          byManufacturer.set(item.manufacturer, (byManufacturer.get(item.manufacturer) ?? 0) + 1);
        }
      });
      const totalItems = bom.length;
      if (totalItems >= 5) {
        for (const [mfr, count] of Array.from(byManufacturer.entries())) {
          if (count >= Math.ceil(totalItems * 0.6)) {
            preds.push(makePrediction(
              'single-source-risk',
              'Diversify component manufacturers',
              `${Math.round((count / totalItems) * 100)}% of your BOM is from ${mfr}. Consider alternate manufacturers for critical components to reduce supply chain risk.`,
              0.67,
              'optimization',
              { type: 'open_view', payload: { view: 'procurement' } },
            ));
            break;
          }
        }
      }
      return preds;
    },
  };
}

export function makeIntegratedSolution(): PredictionRule {
  return {
    id: 'integrated-solution',
    name: 'Consider integrated solution',
    category: 'optimization',
    baseConfidence: 0.55,
    check(nodes) {
      const preds: Prediction[] = [];
      const discreteCount = nodes.filter((n) => isResistor(n) || isCapacitor(n) || isDiode(n) || isTransistor(n)).length;
      if (discreteCount >= 10) {
        preds.push(makePrediction(
          'integrated-solution',
          'Consider integrated IC alternatives',
          `Your design has ${discreteCount} discrete components. Some functions may be available as integrated ICs that reduce board space, assembly cost, and component count.`,
          0.55,
          'optimization',
          { type: 'show_info', payload: { topic: 'integration-opportunities' } },
        ));
      }
      return preds;
    },
  };
}

export function makeUnusedMcuPins(): PredictionRule {
  return {
    id: 'unused-mcu-pins',
    name: 'Expose unused MCU pins',
    category: 'optimization',
    baseConfidence: 0.58,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const mcus = nodes.filter(isMcu);
      mcus.forEach((mcu) => {
        const connectionCount = (adj.get(mcu.id)?.size ?? 0);
        if (connectionCount < 5 && nodes.length >= 3) {
          preds.push(makePrediction(
            'unused-mcu-pins',
            `Add test headers for unused ${mcu.label} pins`,
            `MCU "${mcu.label}" appears to have spare I/O pins. Breaking them out to a header gives you expansion options for future features without a board respin.`,
            0.58,
            'optimization',
            { type: 'add_component', payload: { component: 'pin-header', near: mcu.id } },
          ));
        }
      });
      return preds;
    },
  };
}
