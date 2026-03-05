/**
 * Thermal Analysis Engine
 *
 * Steady-state thermal simulation for PCB designs. Models heat conduction
 * through copper layers and vias, computes junction temperatures, generates
 * 2-D heat maps via Gauss-Seidel relaxation, and classifies thermal risk
 * using Arrhenius-based derating.
 *
 * Usage:
 *   const ta = new ThermalAnalyzer(100, 80, stackup.getLayers());
 *   ta.addComponent({ id: 'U1', name: 'MCU', ... });
 *   ta.setBoundaryConditions({ ambientTemp: 40 });
 *   const result = ta.analyze();
 */

import { useCallback, useRef, useState } from 'react';
import type { StackupLayer } from '@/lib/board-stackup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThermalComponent {
  id: string;
  name: string;
  packageType: string;
  powerDissipation: number; // watts
  thetaJC: number; // degC/W junction-to-case
  thetaCA: number; // degC/W case-to-ambient (still air)
  maxJunctionTemp: number; // degC
  position: { x: number; y: number }; // mm on PCB
  layer: string;
}

export interface ThermalVia {
  position: { x: number; y: number }; // mm
  diameter: number; // mm
  platingThickness: number; // mm
  layers: string[];
}

export interface ThermalBoundaryConditions {
  ambientTemp: number; // degC
  airflowVelocity: number; // m/s (0 = still air)
  heatsinkPresent: boolean;
  heatsinkThetaSA: number; // degC/W sink-to-ambient
  boardOrientation: 'horizontal' | 'vertical';
}

export interface ThermalComponentResult {
  id: string;
  name: string;
  junctionTemp: number;
  caseTemp: number;
  boardTemp: number;
  thermalMargin: number;
  deratingFactor: number;
  riskLevel: 'safe' | 'warning' | 'critical' | 'failure';
  recommendations: string[];
}

export interface ThermalHotspot {
  position: { x: number; y: number };
  temperature: number;
  radius: number; // mm
}

export interface ThermalHeatMap {
  width: number;
  height: number;
  cellSize: number; // mm per cell
  data: number[][];
  minTemp: number;
  maxTemp: number;
}

export interface ThermalResult {
  components: ThermalComponentResult[];
  hotspots: ThermalHotspot[];
  heatMap: ThermalHeatMap;
  totalPowerDissipation: number;
  maxBoardTemp: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Package thermal database (typical values, degC/W)
// ---------------------------------------------------------------------------

const PACKAGE_THERMAL_DB: Record<string, { thetaJC: number; thetaCA: number }> = {
  'SOT-23': { thetaJC: 100, thetaCA: 250 },
  'SOT-223': { thetaJC: 15, thetaCA: 60 },
  'SOIC-8': { thetaJC: 40, thetaCA: 120 },
  'SOIC-16': { thetaJC: 30, thetaCA: 90 },
  'QFP-44': { thetaJC: 20, thetaCA: 50 },
  'QFP-48': { thetaJC: 18, thetaCA: 45 },
  'QFP-64': { thetaJC: 15, thetaCA: 40 },
  'QFP-100': { thetaJC: 10, thetaCA: 30 },
  'BGA-256': { thetaJC: 5, thetaCA: 20 },
  'BGA-484': { thetaJC: 3, thetaCA: 15 },
  'TO-220': { thetaJC: 1.5, thetaCA: 40 },
  'TO-252': { thetaJC: 3, thetaCA: 50 },
  'DIP-8': { thetaJC: 50, thetaCA: 100 },
  'DIP-16': { thetaJC: 40, thetaCA: 80 },
  '0402': { thetaJC: 200, thetaCA: 400 },
  '0603': { thetaJC: 150, thetaCA: 350 },
  '0805': { thetaJC: 100, thetaCA: 250 },
  '1206': { thetaJC: 80, thetaCA: 200 },
};

// ---------------------------------------------------------------------------
// Physical constants
// ---------------------------------------------------------------------------

/** Thermal conductivity of copper, W/(m*K) */
const K_CU = 385;

/** Thermal conductivity of FR4, W/(m*K) */
const K_FR4 = 0.25;

/** Boltzmann constant, eV/K */
const K_BOLTZMANN_EV = 8.617e-5;

/** Activation energy for silicon, eV */
const EA_SILICON = 0.7;

/** Copper weight to thickness in mm */
const COPPER_WEIGHT_MM: Record<string, number> = {
  '0.5oz': 0.0175,
  '1oz': 0.035,
  '2oz': 0.070,
  '3oz': 0.105,
  '4oz': 0.140,
};

/** Default boundary conditions */
const DEFAULT_BOUNDARY: ThermalBoundaryConditions = {
  ambientTemp: 25,
  airflowVelocity: 0,
  heatsinkPresent: false,
  heatsinkThetaSA: 10,
  boardOrientation: 'horizontal',
};

/** Default heat-map cell size in mm */
const DEFAULT_CELL_SIZE = 1;

/** Max Gauss-Seidel iterations */
const MAX_ITERATIONS = 1000;

/** Convergence threshold degC */
const CONVERGENCE_THRESHOLD = 0.01;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function milsToMm(mils: number): number {
  return mils * 0.0254;
}

/**
 * Convection coefficient h for natural / forced convection in W/(m^2*K).
 * Simplified empirical model.
 */
function convectionCoefficient(velocity: number, orientation: 'horizontal' | 'vertical'): number {
  // Natural convection (still air)
  const hNat = orientation === 'vertical' ? 10 : 8; // W/(m^2*K)
  if (velocity <= 0) {
    return hNat;
  }
  // Forced convection — simplified flat plate correlation
  const hForced = 11.4 + 5.7 * velocity; // W/(m^2*K)
  return Math.max(hNat, hForced);
}

/**
 * Airflow-adjusted theta_CA multiplier.  1.0 = still air (baseline).
 * Forced air reduces case-to-ambient resistance.
 */
function airflowMultiplier(velocity: number, orientation: 'horizontal' | 'vertical'): number {
  const hBase = convectionCoefficient(0, orientation);
  const hActual = convectionCoefficient(velocity, orientation);
  return hBase / hActual; // < 1 when forced air
}

/**
 * Copper spreading resistance for a circular source on a copper plane.
 * R_spread = 1 / (k_Cu * t_Cu * sqrt(pi * A_Cu))
 * @param copperThicknessMm copper thickness in mm
 * @param areaMm2 copper area in mm^2
 */
function copperSpreadingResistance(copperThicknessMm: number, areaMm2: number): number {
  if (copperThicknessMm <= 0 || areaMm2 <= 0) {
    return Infinity;
  }
  // Convert to meters
  const tM = copperThicknessMm / 1000;
  const aM2 = areaMm2 / 1e6;
  return 1 / (K_CU * tM * Math.sqrt(Math.PI * aM2));
}

/**
 * Thermal resistance of a single via.
 * R_via = L / (k_Cu * pi * (D^2 - d^2) / 4)
 * where d = D - 2*plating
 */
function viaThermalResistance(via: ThermalVia, boardThicknessMm: number): number {
  const D = via.diameter;
  const d = D - 2 * via.platingThickness;
  if (d <= 0 || D <= 0 || boardThicknessMm <= 0) {
    return Infinity;
  }
  const crossSection = (Math.PI / 4) * (D * D - d * d); // mm^2
  const crossSectionM2 = crossSection / 1e6;
  const lengthM = boardThicknessMm / 1000;
  return lengthM / (K_CU * crossSectionM2);
}

/**
 * Board-to-ambient thermal resistance for a given area under a component.
 * Combines conduction through FR4 + convection from board surface.
 */
function boardToAmbientResistance(
  copperAreaMm2: number,
  boardThicknessMm: number,
  h: number,
): number {
  if (copperAreaMm2 <= 0) {
    return 1000; // very high if no copper
  }
  const areaM2 = copperAreaMm2 / 1e6;
  const thicknessM = boardThicknessMm / 1000;
  const rConduction = thicknessM / (K_FR4 * areaM2);
  const rConvection = 1 / (h * areaM2);
  return rConduction + rConvection;
}

// ---------------------------------------------------------------------------
// ThermalAnalyzer
// ---------------------------------------------------------------------------

export class ThermalAnalyzer {
  private readonly boardWidth: number; // mm
  private readonly boardHeight: number; // mm
  private readonly stackup: StackupLayer[];
  private readonly components: ThermalComponent[] = [];
  private readonly vias: ThermalVia[] = [];
  private boundary: ThermalBoundaryConditions = { ...DEFAULT_BOUNDARY };

  constructor(boardWidth: number, boardHeight: number, stackup: StackupLayer[]) {
    this.boardWidth = Math.max(boardWidth, 1);
    this.boardHeight = Math.max(boardHeight, 1);
    this.stackup = stackup;
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  addComponent(component: ThermalComponent): void {
    this.components.push(component);
  }

  addVia(via: ThermalVia): void {
    this.vias.push(via);
  }

  setBoundaryConditions(conditions: Partial<ThermalBoundaryConditions>): void {
    this.boundary = { ...this.boundary, ...conditions };
  }

  // -------------------------------------------------------------------------
  // Static helpers
  // -------------------------------------------------------------------------

  static lookupPackageThermals(packageType: string): { thetaJC: number; thetaCA: number } | null {
    return PACKAGE_THERMAL_DB[packageType] ?? null;
  }

  /**
   * Arrhenius-based derating factor.
   * Returns 1.0 when currentTemp < 70% of maxTemp, linearly decays to 0 at maxTemp.
   */
  static calculateDerating(currentTemp: number, maxTemp: number): number {
    if (maxTemp <= 0) {
      return 0;
    }
    const threshold = 0.7 * maxTemp;
    if (currentTemp <= threshold) {
      return 1;
    }
    if (currentTemp >= maxTemp) {
      return 0;
    }
    return (maxTemp - currentTemp) / (maxTemp - threshold);
  }

  // -------------------------------------------------------------------------
  // Board geometry helpers
  // -------------------------------------------------------------------------

  /** Total board thickness in mm (sum of all layers). */
  private totalBoardThickness(): number {
    if (this.stackup.length === 0) {
      return 1.6; // default 1.6 mm FR4
    }
    return this.stackup.reduce((sum, l) => sum + milsToMm(l.thickness), 0);
  }

  /** Total copper thickness in mm (sum of copper layers). */
  private totalCopperThickness(): number {
    if (this.stackup.length === 0) {
      return COPPER_WEIGHT_MM['1oz'];
    }
    let total = 0;
    for (const layer of this.stackup) {
      total += COPPER_WEIGHT_MM[layer.copperWeight] ?? COPPER_WEIGHT_MM['1oz'];
    }
    return total;
  }

  /** Estimate effective copper area under a component (mm^2). */
  private estimateCopperArea(comp: ThermalComponent): number {
    // Heuristic: component footprint + spreading factor
    const footprintArea = this.packageFootprintArea(comp.packageType);
    const spreadFactor = 4; // copper typically spreads 2x in each direction
    return Math.min(footprintArea * spreadFactor, this.boardWidth * this.boardHeight);
  }

  /** Rough footprint area in mm^2 based on package type. */
  private packageFootprintArea(pkg: string): number {
    const areas: Record<string, number> = {
      'SOT-23': 6,
      'SOT-223': 30,
      'SOIC-8': 30,
      'SOIC-16': 60,
      'QFP-44': 144,
      'QFP-48': 144,
      'QFP-64': 196,
      'QFP-100': 324,
      'BGA-256': 289,
      'BGA-484': 529,
      'TO-220': 80,
      'TO-252': 50,
      'DIP-8': 60,
      'DIP-16': 120,
      '0402': 1,
      '0603': 2.5,
      '0805': 5,
      '1206': 10,
    };
    return areas[pkg] ?? 25;
  }

  /** Count vias near a component (within 10mm). */
  private viasNearComponent(comp: ThermalComponent): ThermalVia[] {
    const radius = 10; // mm
    return this.vias.filter((v) => {
      const dx = v.position.x - comp.position.x;
      const dy = v.position.y - comp.position.y;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  // -------------------------------------------------------------------------
  // Thermal resistance network per component
  // -------------------------------------------------------------------------

  /**
   * Compute the total thermal resistance path and junction temperature for one
   * component.
   */
  private analyzeComponent(comp: ThermalComponent, boardTempAtLocation: number): ThermalComponentResult {
    const ambient = this.boundary.ambientTemp;
    const h = convectionCoefficient(this.boundary.airflowVelocity, this.boundary.boardOrientation);
    const afMult = airflowMultiplier(this.boundary.airflowVelocity, this.boundary.boardOrientation);

    // Junction-to-case
    const thetaJC = comp.thetaJC;

    // Case-to-solder (package dependent, 0.5-2.0 degC/W)
    const thetaCS = this.packageCaseToSolderResistance(comp.packageType);

    // Solder/board-to-ambient
    const copperArea = this.estimateCopperArea(comp);
    const copperThickness = this.totalCopperThickness();
    const boardThickness = this.totalBoardThickness();

    // Copper spreading
    const rSpread = copperSpreadingResistance(copperThickness, copperArea);

    // Via contribution (parallel resistance)
    const nearbyVias = this.viasNearComponent(comp);
    let rViaParallel = Infinity;
    if (nearbyVias.length > 0) {
      let conductance = 0;
      for (const via of nearbyVias) {
        const rVia = viaThermalResistance(via, boardThickness);
        if (isFinite(rVia) && rVia > 0) {
          conductance += 1 / rVia;
        }
      }
      if (conductance > 0) {
        rViaParallel = 1 / conductance;
      }
    }

    // Board-to-ambient
    const rBoardAmb = boardToAmbientResistance(copperArea, boardThickness, h);

    // Heatsink path (parallel to board-to-ambient)
    let thetaSA: number;
    if (this.boundary.heatsinkPresent) {
      const rHS = this.boundary.heatsinkThetaSA;
      // Board path in parallel with heatsink
      const rBoardPath = rSpread + (isFinite(rViaParallel) ? rViaParallel : 0) + rBoardAmb;
      thetaSA = (rBoardPath * rHS) / (rBoardPath + rHS);
    } else {
      // Adjust case-to-ambient for airflow
      thetaSA = comp.thetaCA * afMult;
      // Also factor in copper/via benefit — reduce thetaSA by spreading benefit
      const spreadBenefit = Math.min(rSpread, thetaSA * 0.3);
      thetaSA = Math.max(thetaSA - spreadBenefit, 1);
      if (isFinite(rViaParallel)) {
        // Vias provide an additional heat path
        const viaBenefit = Math.min(1 / (1 / rViaParallel + 1 / thetaSA), thetaSA);
        thetaSA = viaBenefit;
      }
    }

    const P = comp.powerDissipation;

    // Temperatures
    const boardTemp = Math.max(boardTempAtLocation, ambient);
    const caseTemp = boardTemp + P * thetaCS;
    const junctionTemp = caseTemp + P * thetaJC;

    // Also compute from ambient path for comparison, use higher
    const junctionFromAmbient = ambient + P * (thetaJC + thetaCS + thetaSA);
    const finalJunction = Math.max(junctionTemp, junctionFromAmbient);
    const finalCase = finalJunction - P * thetaJC;

    const thermalMargin = comp.maxJunctionTemp - finalJunction;
    const deratingFactor = ThermalAnalyzer.calculateDerating(finalJunction, comp.maxJunctionTemp);
    const riskLevel = this.classifyRisk(finalJunction, comp.maxJunctionTemp);
    const recommendations = this.generateRecommendations(comp, finalJunction, riskLevel, nearbyVias.length);

    return {
      id: comp.id,
      name: comp.name,
      junctionTemp: Math.round(finalJunction * 100) / 100,
      caseTemp: Math.round(finalCase * 100) / 100,
      boardTemp: Math.round(boardTemp * 100) / 100,
      thermalMargin: Math.round(thermalMargin * 100) / 100,
      deratingFactor: Math.round(deratingFactor * 1000) / 1000,
      riskLevel,
      recommendations,
    };
  }

  private packageCaseToSolderResistance(pkg: string): number {
    // Larger packages have lower case-to-solder resistance
    const map: Record<string, number> = {
      'SOT-23': 2.0,
      'SOT-223': 1.0,
      'SOIC-8': 1.5,
      'SOIC-16': 1.2,
      'QFP-44': 1.0,
      'QFP-48': 1.0,
      'QFP-64': 0.8,
      'QFP-100': 0.6,
      'BGA-256': 0.3,
      'BGA-484': 0.2,
      'TO-220': 0.5,
      'TO-252': 0.8,
      'DIP-8': 1.5,
      'DIP-16': 1.2,
      '0402': 2.0,
      '0603': 1.8,
      '0805': 1.5,
      '1206': 1.2,
    };
    return map[pkg] ?? 1.0;
  }

  private classifyRisk(junctionTemp: number, maxTemp: number): 'safe' | 'warning' | 'critical' | 'failure' {
    if (maxTemp <= 0) {
      return 'failure';
    }
    const ratio = junctionTemp / maxTemp;
    if (ratio >= 1) {
      return 'failure';
    }
    if (ratio >= 0.85) {
      return 'critical';
    }
    if (ratio >= 0.7) {
      return 'warning';
    }
    return 'safe';
  }

  private generateRecommendations(
    comp: ThermalComponent,
    junctionTemp: number,
    risk: string,
    viaCount: number,
  ): string[] {
    const recs: string[] = [];

    if (risk === 'failure') {
      recs.push(`CRITICAL: ${comp.name} exceeds maximum junction temperature (${comp.maxJunctionTemp} degC). Redesign required.`);
      recs.push('Add a heatsink or increase copper pour area.');
      recs.push('Consider a package with lower thermal resistance (e.g., exposed pad).');
    } else if (risk === 'critical') {
      recs.push(`${comp.name} is operating near its thermal limit (${Math.round(junctionTemp)} degC / ${comp.maxJunctionTemp} degC).`);
      if (viaCount < 4) {
        recs.push('Add thermal vias under the component to improve heat spreading.');
      }
      if (!this.boundary.heatsinkPresent) {
        recs.push('Consider adding a heatsink.');
      }
      if (this.boundary.airflowVelocity === 0) {
        recs.push('Add forced-air cooling to reduce junction temperature.');
      }
    } else if (risk === 'warning') {
      if (viaCount < 2) {
        recs.push('Thermal vias would improve heat dissipation.');
      }
      recs.push('Ensure adequate copper pour around component.');
    }

    return recs;
  }

  // -------------------------------------------------------------------------
  // 2-D Heat Map (Gauss-Seidel)
  // -------------------------------------------------------------------------

  /**
   * Generate steady-state heat map using iterative Gauss-Seidel relaxation
   * on a uniform grid. Each cell's temperature is the average of its 4
   * neighbours plus any local power source contribution.
   */
  private generateHeatMap(): ThermalHeatMap {
    const cellSize = DEFAULT_CELL_SIZE;
    const w = Math.max(1, Math.ceil(this.boardWidth / cellSize));
    const h = Math.max(1, Math.ceil(this.boardHeight / cellSize));
    const ambient = this.boundary.ambientTemp;

    // Thermal conductivity of board in-plane (copper-dominated)
    const copperThickness = this.totalCopperThickness();
    const boardThickness = this.totalBoardThickness();
    // Effective in-plane conductivity (copper fraction weighted)
    const copperFraction = boardThickness > 0 ? copperThickness / boardThickness : 0.02;
    const kEffective = copperFraction * K_CU + (1 - copperFraction) * K_FR4;

    // Convection loss coefficient per cell
    const hConv = convectionCoefficient(this.boundary.airflowVelocity, this.boundary.boardOrientation);
    const cellAreaM2 = (cellSize / 1000) * (cellSize / 1000);
    const cellThicknessM = boardThickness / 1000;

    // Biot-like ratio: convection loss relative to conduction
    const beta = (hConv * cellAreaM2) / (kEffective * cellThicknessM * cellSize / 1000);

    // Initialize grid to ambient
    const grid: number[][] = [];
    for (let j = 0; j < h; j++) {
      grid.push(new Array<number>(w).fill(ambient));
    }

    // Build power source map (W per cell)
    const powerMap: number[][] = [];
    for (let j = 0; j < h; j++) {
      powerMap.push(new Array<number>(w).fill(0));
    }

    for (const comp of this.components) {
      if (comp.powerDissipation <= 0) {
        continue;
      }
      const ci = Math.floor(comp.position.x / cellSize);
      const cj = Math.floor(comp.position.y / cellSize);
      if (ci >= 0 && ci < w && cj >= 0 && cj < h) {
        powerMap[cj][ci] += comp.powerDissipation;
      }
    }

    // Thermal resistance of one cell (conduction to neighbour)
    // R_cell = cellSize / (k * thickness * cellSize) = 1 / (k * thickness)
    const rCell = kEffective > 0 && cellThicknessM > 0
      ? 1 / (kEffective * cellThicknessM)
      : 1e6;

    // Gauss-Seidel iteration
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let maxDelta = 0;

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          // Neighbour temperatures (boundary = ambient via convection)
          const tUp = j > 0 ? grid[j - 1][i] : ambient;
          const tDown = j < h - 1 ? grid[j + 1][i] : ambient;
          const tLeft = i > 0 ? grid[j][i - 1] : ambient;
          const tRight = i < w - 1 ? grid[j][i + 1] : ambient;

          const neighbourSum = tUp + tDown + tLeft + tRight;
          const powerContribution = powerMap[j][i] * rCell;

          const newTemp = (neighbourSum + beta * ambient + powerContribution) / (4 + beta);
          const delta = Math.abs(newTemp - grid[j][i]);
          if (delta > maxDelta) {
            maxDelta = delta;
          }
          grid[j][i] = newTemp;
        }
      }

      if (maxDelta < CONVERGENCE_THRESHOLD) {
        break;
      }
    }

    // Compute min/max
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const t = grid[j][i];
        if (t < minTemp) { minTemp = t; }
        if (t > maxTemp) { maxTemp = t; }
      }
    }

    if (!isFinite(minTemp)) { minTemp = ambient; }
    if (!isFinite(maxTemp)) { maxTemp = ambient; }

    return { width: w, height: h, cellSize, data: grid, minTemp, maxTemp };
  }

  /** Get board temperature at a specific location from the heat map. */
  private boardTempAt(heatMap: ThermalHeatMap, x: number, y: number): number {
    const i = Math.min(Math.max(0, Math.floor(x / heatMap.cellSize)), heatMap.width - 1);
    const j = Math.min(Math.max(0, Math.floor(y / heatMap.cellSize)), heatMap.height - 1);
    return heatMap.data[j][i];
  }

  // -------------------------------------------------------------------------
  // Hotspot detection
  // -------------------------------------------------------------------------

  private detectHotspots(heatMap: ThermalHeatMap): ThermalHotspot[] {
    const hotspots: ThermalHotspot[] = [];
    const ambient = this.boundary.ambientTemp;
    const threshold = ambient + (heatMap.maxTemp - ambient) * 0.7;

    if (heatMap.maxTemp <= ambient + 1) {
      return hotspots;
    }

    // Find local maxima above threshold
    for (let j = 1; j < heatMap.height - 1; j++) {
      for (let i = 1; i < heatMap.width - 1; i++) {
        const t = heatMap.data[j][i];
        if (t < threshold) {
          continue;
        }
        // Check if local maximum
        const isMax =
          t >= heatMap.data[j - 1][i] &&
          t >= heatMap.data[j + 1][i] &&
          t >= heatMap.data[j][i - 1] &&
          t >= heatMap.data[j][i + 1];
        if (isMax) {
          // Estimate affected radius: how far until temp drops below threshold
          let radius = heatMap.cellSize;
          for (let r = 1; r < Math.max(heatMap.width, heatMap.height); r++) {
            const ri = Math.min(i + r, heatMap.width - 1);
            if (heatMap.data[j][ri] < threshold) {
              radius = r * heatMap.cellSize;
              break;
            }
            radius = r * heatMap.cellSize;
          }
          hotspots.push({
            position: {
              x: (i + 0.5) * heatMap.cellSize,
              y: (j + 0.5) * heatMap.cellSize,
            },
            temperature: Math.round(t * 100) / 100,
            radius,
          });
        }
      }
    }

    return hotspots;
  }

  // -------------------------------------------------------------------------
  // Summary generation
  // -------------------------------------------------------------------------

  private generateSummary(results: ThermalComponentResult[], totalPower: number, maxBoardTemp: number): string {
    const failureCount = results.filter((r) => r.riskLevel === 'failure').length;
    const criticalCount = results.filter((r) => r.riskLevel === 'critical').length;
    const warningCount = results.filter((r) => r.riskLevel === 'warning').length;

    const parts: string[] = [];
    parts.push(`Thermal analysis of ${results.length} component(s) with ${totalPower.toFixed(2)}W total power dissipation.`);
    parts.push(`Max board temperature: ${maxBoardTemp.toFixed(1)} degC (ambient: ${this.boundary.ambientTemp} degC).`);

    if (failureCount > 0) {
      parts.push(`FAILURE: ${failureCount} component(s) exceed maximum junction temperature.`);
    }
    if (criticalCount > 0) {
      parts.push(`CRITICAL: ${criticalCount} component(s) near thermal limit.`);
    }
    if (warningCount > 0) {
      parts.push(`WARNING: ${warningCount} component(s) in thermal warning zone.`);
    }
    if (failureCount === 0 && criticalCount === 0 && warningCount === 0) {
      parts.push('All components operating within safe thermal margins.');
    }

    return parts.join(' ');
  }

  // -------------------------------------------------------------------------
  // Main analysis
  // -------------------------------------------------------------------------

  analyze(): ThermalResult {
    const totalPower = this.components.reduce((s, c) => s + c.powerDissipation, 0);

    // Generate heat map first to get board temperatures
    const heatMap = this.generateHeatMap();

    // Analyze each component
    const componentResults: ThermalComponentResult[] = [];
    for (const comp of this.components) {
      const boardTemp = this.boardTempAt(heatMap, comp.position.x, comp.position.y);
      componentResults.push(this.analyzeComponent(comp, boardTemp));
    }

    const hotspots = this.detectHotspots(heatMap);
    const maxBoardTemp = heatMap.maxTemp;
    const summary = this.generateSummary(componentResults, totalPower, maxBoardTemp);

    return {
      components: componentResults,
      hotspots,
      heatMap,
      totalPowerDissipation: totalPower,
      maxBoardTemp: Math.round(maxBoardTemp * 100) / 100,
      summary,
    };
  }

  /**
   * Get heat map for a specific layer. Currently returns the same board-level
   * heat map since layer-specific modeling requires full 3-D FEM.
   */
  getHeatMapAtLayer(_layerId: string): ThermalHeatMap {
    return this.generateHeatMap();
  }
}

// ---------------------------------------------------------------------------
// Exported helper functions (for direct use / testing)
// ---------------------------------------------------------------------------

export { viaThermalResistance, copperSpreadingResistance, convectionCoefficient, airflowMultiplier };

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useThermalAnalysis(): {
  analyze: (
    components: ThermalComponent[],
    vias: ThermalVia[],
    boardWidth: number,
    boardHeight: number,
    stackup?: StackupLayer[],
    boundary?: Partial<ThermalBoundaryConditions>,
  ) => ThermalResult;
  result: ThermalResult | null;
  isAnalyzing: boolean;
} {
  const [result, setResult] = useState<ThermalResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzerRef = useRef<ThermalAnalyzer | null>(null);

  const analyze = useCallback(
    (
      components: ThermalComponent[],
      vias: ThermalVia[],
      boardWidth: number,
      boardHeight: number,
      stackup?: StackupLayer[],
      boundary?: Partial<ThermalBoundaryConditions>,
    ): ThermalResult => {
      setIsAnalyzing(true);
      try {
        const ta = new ThermalAnalyzer(boardWidth, boardHeight, stackup ?? []);
        analyzerRef.current = ta;
        for (const c of components) {
          ta.addComponent(c);
        }
        for (const v of vias) {
          ta.addVia(v);
        }
        if (boundary) {
          ta.setBoundaryConditions(boundary);
        }
        const r = ta.analyze();
        setResult(r);
        return r;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  return { analyze, result, isAnalyzing };
}
