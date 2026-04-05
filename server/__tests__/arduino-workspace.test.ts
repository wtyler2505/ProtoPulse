import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArduinoWorkspace } from '@shared/schema';
import type { IStorage } from '../storage';

const mkdirMock = vi.fn();
const readdirMock = vi.fn();

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => Buffer.from('{"VersionString":"1.0.0"}')),
  execFileSync: vi.fn(() => Buffer.from('[]')),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    readdir: readdirMock,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn(),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
    unlink: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function makeWorkspace(overrides: Partial<ArduinoWorkspace> = {}): ArduinoWorkspace {
  return {
    id: 1,
    projectId: 21,
    rootPath: '/tmp/sketches/project_21',
    activeSketchPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeStorage(overrides: Partial<IStorage> = {}) {
  return {
    getArduinoWorkspace: vi.fn(),
    createArduinoWorkspace: vi.fn(),
    getArduinoWorkspaces: vi.fn(),
    upsertArduinoSketchFile: vi.fn(),
    ...overrides,
  } as unknown as IStorage;
}

describe('ArduinoService workspace bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdirMock.mockResolvedValue(undefined);
    readdirMock.mockResolvedValue([]);
  });

  it('heals a missing workspace directory when a workspace row already exists', async () => {
    const workspace = makeWorkspace();
    const storage = makeStorage({
      getArduinoWorkspace: vi.fn().mockResolvedValue(workspace),
    });
    const { ArduinoService } = await import('../arduino-service');
    const service = new ArduinoService(storage);

    const result = await service.ensureWorkspace(workspace.projectId);

    expect(result).toEqual(workspace);
    expect(storage.createArduinoWorkspace).not.toHaveBeenCalled();
    expect(mkdirMock).toHaveBeenCalledWith(workspace.rootPath, { recursive: true });
  });

  it('deduplicates concurrent workspace creation requests for the same project', async () => {
    const created = makeWorkspace({ id: 7, projectId: 77 });
    const storage = makeStorage({
      getArduinoWorkspace: vi.fn().mockResolvedValue(undefined),
      createArduinoWorkspace: vi.fn().mockImplementation(async () => created),
    });
    const { ArduinoService } = await import('../arduino-service');
    const service = new ArduinoService(storage);

    const [first, second] = await Promise.all([
      service.ensureWorkspace(created.projectId),
      service.ensureWorkspace(created.projectId),
    ]);

    expect(first).toEqual(created);
    expect(second).toEqual(created);
    expect(storage.getArduinoWorkspace).toHaveBeenCalledTimes(1);
    expect(storage.createArduinoWorkspace).toHaveBeenCalledTimes(1);
    expect(mkdirMock).toHaveBeenCalledTimes(1);
    expect(mkdirMock).toHaveBeenCalledWith(
      expect.stringContaining('/data/sketches/project_77'),
      { recursive: true },
    );
  });

  it('recreates the root directory before scanning workspace files', async () => {
    const workspace = makeWorkspace({ id: 15, projectId: 150 });
    const storage = makeStorage({
      getArduinoWorkspaces: vi.fn().mockResolvedValue([workspace]),
    });
    const { ArduinoService } = await import('../arduino-service');
    const service = new ArduinoService(storage);

    await service.scanWorkspace(workspace.id);

    expect(mkdirMock).toHaveBeenCalledWith(workspace.rootPath, { recursive: true });
    expect(readdirMock).toHaveBeenCalledWith(workspace.rootPath, { withFileTypes: true });
  });
});
