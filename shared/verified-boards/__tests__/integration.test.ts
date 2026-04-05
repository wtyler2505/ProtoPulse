import { describe, expect, it } from 'vitest';
import {
  getAllVerifiedBoards,
  getVerifiedBoard,
  findVerifiedBoardByAlias,
} from '../index';

describe('Verified Board Pack integration', () => {
  it('getAllVerifiedBoards returns all 3 boards', () => {
    const boards = getAllVerifiedBoards();
    expect(boards).toHaveLength(3);
    const ids = boards.map((b) => b.id);
    expect(ids).toContain('arduino-mega-2560-r3');
    expect(ids).toContain('nodemcu-esp32s');
    expect(ids).toContain('riorand-kjl01');
  });

  it('getVerifiedBoard looks up by ID', () => {
    const mega = getVerifiedBoard('arduino-mega-2560-r3');
    expect(mega).toBeDefined();
    expect(mega?.title).toBe('Arduino Mega 2560 R3');

    const esp = getVerifiedBoard('nodemcu-esp32s');
    expect(esp).toBeDefined();
    expect(esp?.title).toBe('NodeMCU ESP32-S');

    const riorand = getVerifiedBoard('riorand-kjl01');
    expect(riorand).toBeDefined();
    expect(riorand?.title).toContain('RioRand');
  });

  it('getVerifiedBoard returns undefined for unknown IDs', () => {
    expect(getVerifiedBoard('arduino-nano')).toBeUndefined();
    expect(getVerifiedBoard('')).toBeUndefined();
  });

  it('findVerifiedBoardByAlias matches by title', () => {
    const mega = findVerifiedBoardByAlias('Arduino Mega 2560 R3');
    expect(mega?.id).toBe('arduino-mega-2560-r3');
  });

  it('findVerifiedBoardByAlias matches by alias', () => {
    const esp = findVerifiedBoardByAlias('ESP32 DevKit');
    expect(esp?.id).toBe('nodemcu-esp32s');

    const mega = findVerifiedBoardByAlias('Mega 2560');
    expect(mega?.id).toBe('arduino-mega-2560-r3');

    const riorand = findVerifiedBoardByAlias('KJL-01');
    expect(riorand?.id).toBe('riorand-kjl01');
  });

  it('findVerifiedBoardByAlias is case-insensitive', () => {
    expect(findVerifiedBoardByAlias('arduino mega')?.id).toBe('arduino-mega-2560-r3');
    expect(findVerifiedBoardByAlias('ESP32 DEVKIT')?.id).toBe('nodemcu-esp32s');
    expect(findVerifiedBoardByAlias('riorand motor controller')?.id).toBe('riorand-kjl01');
  });

  it('findVerifiedBoardByAlias matches substring', () => {
    expect(findVerifiedBoardByAlias('Mega')?.id).toBe('arduino-mega-2560-r3');
    expect(findVerifiedBoardByAlias('ESP32')?.id).toBe('nodemcu-esp32s');
    expect(findVerifiedBoardByAlias('RioRand')?.id).toBe('riorand-kjl01');
  });

  it('findVerifiedBoardByAlias returns undefined for no match', () => {
    expect(findVerifiedBoardByAlias('Raspberry Pi')).toBeUndefined();
    expect(findVerifiedBoardByAlias('')).toBeUndefined();
  });

  it('all boards have non-empty evidence', () => {
    for (const board of getAllVerifiedBoards()) {
      expect(board.evidence.length).toBeGreaterThan(0);
    }
  });

  it('all boards have non-empty pins', () => {
    for (const board of getAllVerifiedBoards()) {
      expect(board.pins.length).toBeGreaterThan(0);
    }
  });

  it('all boards have non-empty buses', () => {
    for (const board of getAllVerifiedBoards()) {
      expect(board.buses.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate pin IDs within any board', () => {
    for (const board of getAllVerifiedBoards()) {
      const ids = board.pins.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('no duplicate bus IDs within any board', () => {
    for (const board of getAllVerifiedBoards()) {
      const ids = board.buses.map((b) => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('all header pinIds reference real pins', () => {
    for (const board of getAllVerifiedBoards()) {
      const pinIds = new Set(board.pins.map((p) => p.id));
      for (const header of board.headerLayout) {
        for (const pid of header.pinIds) {
          expect(pinIds.has(pid)).toBe(true);
        }
      }
    }
  });

  it('header pinCount matches pinIds length', () => {
    for (const board of getAllVerifiedBoards()) {
      for (const header of board.headerLayout) {
        expect(header.pinCount).toBe(header.pinIds.length);
      }
    }
  });
});
