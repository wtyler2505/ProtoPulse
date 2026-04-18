/**
 * Rule registry. `getAllRules()` returns every built-in rule in a stable,
 * observable order (missing component → best practice → safety →
 * optimization → learning tip). Tests and `PredictionEngine.getRules()`
 * depend on this ordering.
 */

import type { PredictionRule } from '../types';

import {
  makePowerIndicator,
  makeFerriteBeadSharedPower,
  makeHighCurrentTraces,
  makeSwitchingRegulatorInductor,
  makeSensorFiltering,
  makeStarGrounding,
  makeTestPoints,
  makeMountingHoles,
} from './best-practice';
import {
  makeTipDatasheets,
  makeTipDropoutVoltage,
  makeTipDecouplingWhy,
  makeTipBaseResistor,
} from './learning-tips';
import {
  makeMcuDecouplingCaps,
  makeMcuCrystal,
  makeMotorFlybackDiode,
  makeRegulatorCaps,
  makeIcBypassCap,
  makeReversePolarity,
  makeAdcReferenceVoltage,
  makeLedResistor,
  makeHBridgeBootstrapCaps,
  makeUsbEsdProtection,
} from './missing-components';
import {
  makeDuplicateResistorValues,
  makeSingleSourceRisk,
  makeIntegratedSolution,
  makeUnusedMcuPins,
} from './optimization';
import {
  makeMainsFuse,
  makeBatteryProtection,
  makeMotorCurrentSensing,
  makeHighVoltageIsolation,
  makeConnectorEsdProtection,
  makeThermalManagement,
} from './safety';

export function getAllRules(): PredictionRule[] {
  return [
    // Missing component (10)
    makeMcuDecouplingCaps(),
    makeMcuCrystal(),
    makeMotorFlybackDiode(),
    makeRegulatorCaps(),
    makeIcBypassCap(),
    makeReversePolarity(),
    makeAdcReferenceVoltage(),
    makeLedResistor(),
    makeHBridgeBootstrapCaps(),
    makeUsbEsdProtection(),
    // Best practice (8)
    makePowerIndicator(),
    makeFerriteBeadSharedPower(),
    makeHighCurrentTraces(),
    makeSwitchingRegulatorInductor(),
    makeSensorFiltering(),
    makeStarGrounding(),
    makeTestPoints(),
    makeMountingHoles(),
    // Safety (6)
    makeMainsFuse(),
    makeBatteryProtection(),
    makeMotorCurrentSensing(),
    makeHighVoltageIsolation(),
    makeConnectorEsdProtection(),
    makeThermalManagement(),
    // Optimization (4)
    makeDuplicateResistorValues(),
    makeSingleSourceRisk(),
    makeIntegratedSolution(),
    makeUnusedMcuPins(),
    // Learning tips (4)
    makeTipDatasheets(),
    makeTipDropoutVoltage(),
    makeTipDecouplingWhy(),
    makeTipBaseResistor(),
  ];
}
