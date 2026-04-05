import { describe, expect, it } from 'vitest';
import { MEGA_2560_R3 } from '../mega-2560-r3';
import { NODEMCU_ESP32S } from '../nodemcu-esp32s';
import { RIORAND_KJL01 } from '../riorand-kjl01';
import { boardDefinitionToPartState } from '../to-part-state';

describe('boardDefinitionToPartState conversion', () => {
  describe('Arduino Mega 2560 R3', () => {
    const state = boardDefinitionToPartState(MEGA_2560_R3);

    it('produces one connector per pin', () => {
      expect(state.connectors).toHaveLength(MEGA_2560_R3.pins.length);
    });

    it('produces one bus per board bus', () => {
      expect(state.buses).toHaveLength(MEGA_2560_R3.buses.length);
    });

    it('bus connectorIds reference valid connector IDs', () => {
      const connIds = new Set(state.connectors.map((c) => c.id));
      for (const bus of state.buses) {
        for (const cid of bus.connectorIds) {
          expect(connIds.has(cid)).toBe(true);
        }
      }
    });

    it('sets verification status to verified', () => {
      expect(state.meta.verificationStatus).toBe('verified');
    });

    it('sets verification level to official-backed', () => {
      expect(state.meta.verificationLevel).toBe('official-backed');
    });

    it('has no breadboard positions (not breadboard-friendly)', () => {
      const withBbPos = state.connectors.filter(
        (c) => c.terminalPositions['breadboard'] != null,
      );
      expect(withBbPos).toHaveLength(0);
    });

    it('has schematic positions for all connectors', () => {
      for (const conn of state.connectors) {
        expect(conn.terminalPositions['schematic']).toBeDefined();
      }
    });

    it('populates meta title and manufacturer', () => {
      expect(state.meta.title).toBe('Arduino Mega 2560 R3');
      expect(state.meta.manufacturer).toBe('Arduino');
    });

    it('has datasheet URL', () => {
      expect(state.meta.datasheetUrl).toContain('arduino.cc');
    });

    it('has breadboard model quality set to verified', () => {
      expect(state.meta.breadboardModelQuality).toBe('verified');
    });

    it('includes source evidence', () => {
      expect(state.meta.sourceEvidence).toBeDefined();
      expect(state.meta.sourceEvidence!.length).toBeGreaterThan(0);
    });

    it('pin accuracy report marks connector names as exact', () => {
      expect(state.meta.pinAccuracyReport?.connectorNames).toBe('exact');
      expect(state.meta.pinAccuracyReport?.electricalRoles).toBe('exact');
    });
  });

  describe('NodeMCU ESP32-S', () => {
    const state = boardDefinitionToPartState(NODEMCU_ESP32S);

    it('produces one connector per pin', () => {
      expect(state.connectors).toHaveLength(38);
    });

    it('has breadboard positions (requires_jumpers fit)', () => {
      const withBbPos = state.connectors.filter(
        (c) => c.terminalPositions['breadboard'] != null,
      );
      expect(withBbPos.length).toBeGreaterThan(0);
    });

    it('sets verification level to official-backed', () => {
      expect(state.meta.verificationLevel).toBe('official-backed');
    });

    it('includes boot pin warning in verification notes', () => {
      expect(state.meta.verificationNotes?.some((n) => n.includes('strapping'))).toBe(true);
    });

    it('lists restricted pins in pinAccuracyReport unresolved', () => {
      expect(state.meta.pinAccuracyReport?.unresolved).toBeDefined();
      expect(state.meta.pinAccuracyReport!.unresolved.length).toBeGreaterThan(0);
      expect(state.meta.pinAccuracyReport!.unresolved.some((u) => u.includes('GPIO6'))).toBe(true);
    });
  });

  describe('RioRand KJL-01', () => {
    const state = boardDefinitionToPartState(RIORAND_KJL01);

    it('produces one connector per pin', () => {
      expect(state.connectors).toHaveLength(14);
    });

    it('sets verification level to mixed-source (no official datasheet)', () => {
      expect(state.meta.verificationLevel).toBe('mixed-source');
    });

    it('has no breadboard positions (not breadboard-friendly)', () => {
      const withBbPos = state.connectors.filter(
        (c) => c.terminalPositions['breadboard'] != null,
      );
      expect(withBbPos).toHaveLength(0);
    });

    it('classifies as driver family', () => {
      expect(state.meta.partFamily).toBe('driver');
    });

    it('has marketplace evidence', () => {
      expect(state.meta.sourceEvidence?.some((e) => e.type === 'marketplace-listing')).toBe(true);
    });
  });
});
