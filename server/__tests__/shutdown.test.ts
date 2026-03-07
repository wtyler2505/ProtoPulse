import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Server } from 'http';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted ensures these are available during vi.mock
// ---------------------------------------------------------------------------

const { mockPoolEnd, mockShutdownGraceful, mockLoggerInfo, mockLoggerError } = vi.hoisted(() => ({
  mockPoolEnd: vi.fn().mockResolvedValue(undefined),
  mockShutdownGraceful: vi.fn().mockResolvedValue(undefined),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

vi.mock('../db', () => ({
  pool: { end: mockPoolEnd },
}));

vi.mock('../job-queue', () => ({
  jobQueue: {
    shutdownGraceful: mockShutdownGraceful,
  },
}));

// We need to prevent process.exit from actually exiting in tests
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((() => {
  // no-op
}) as unknown as typeof process.exit);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { performGracefulShutdown, registerCollaborationServer } from '../shutdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockHttpServer(connectionCount = 5): Server {
  return {
    getConnections: vi.fn((cb: (err: Error | null, count: number) => void) => {
      cb(null, connectionCount);
    }),
    close: vi.fn((cb: (err?: Error) => void) => {
      cb();
    }),
  } as unknown as Server;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('performGracefulShutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockProcessExit.mockClear();
    mockPoolEnd.mockResolvedValue(undefined);
    mockShutdownGraceful.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs the shutdown signal', async () => {
    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    expect(mockLoggerInfo).toHaveBeenCalledWith('Graceful shutdown initiated', { signal: 'SIGTERM' });
  });

  it('logs active connection count', async () => {
    const server = createMockHttpServer(12);
    await performGracefulShutdown(server, 'SIGINT');

    expect(mockLoggerInfo).toHaveBeenCalledWith('Shutdown: active connections', { count: 12 });
  });

  it('drains the job queue with 10s grace period', async () => {
    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    expect(mockShutdownGraceful).toHaveBeenCalledWith(10_000);
  });

  it('closes the HTTP server', async () => {
    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    expect(server.close).toHaveBeenCalled();
  });

  it('closes the database pool', async () => {
    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('calls process.exit(0) on success', async () => {
    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  it('handles HTTP server close error gracefully', async () => {
    const server = {
      getConnections: vi.fn((cb: (err: Error | null, count: number) => void) => {
        cb(null, 0);
      }),
      close: vi.fn((cb: (err?: Error) => void) => {
        cb(new Error('close failed'));
      }),
    } as unknown as Server;

    await performGracefulShutdown(server, 'SIGTERM');

    expect(mockLoggerError).toHaveBeenCalledWith('Error during graceful shutdown', {
      error: 'close failed',
    });
    // Should still attempt to exit
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  it('handles getConnections error gracefully', async () => {
    const server = {
      getConnections: vi.fn((cb: (err: Error | null, count: number) => void) => {
        cb(new Error('connection count failed'), 0);
      }),
      close: vi.fn((cb: (err?: Error) => void) => {
        cb();
      }),
    } as unknown as Server;

    await performGracefulShutdown(server, 'SIGTERM');

    // Should log -1 for connection count on error
    expect(mockLoggerInfo).toHaveBeenCalledWith('Shutdown: active connections', { count: -1 });
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });
});

describe('registerCollaborationServer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockProcessExit.mockClear();
    mockPoolEnd.mockResolvedValue(undefined);
    mockShutdownGraceful.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Reset by registering null (internal state reset)
    registerCollaborationServer(null as unknown as { shutdown(): void });
  });

  it('shuts down the collaboration server when registered', async () => {
    const mockCollabShutdown = vi.fn();
    registerCollaborationServer({ shutdown: mockCollabShutdown });

    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    expect(mockCollabShutdown).toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith('Shutdown: closing collaboration WebSocket server');
    expect(mockLoggerInfo).toHaveBeenCalledWith('Shutdown: collaboration server closed');
  });

  it('skips collaboration shutdown when not registered', async () => {
    // Don't register anything
    const server = createMockHttpServer();
    await performGracefulShutdown(server, 'SIGTERM');

    // Should not log collab shutdown messages
    const infoCalls = mockLoggerInfo.mock.calls.map((c: unknown[]) => c[0]);
    expect(infoCalls).not.toContain('Shutdown: closing collaboration WebSocket server');
  });
});

describe('shutdown execution order', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockProcessExit.mockClear();
    mockPoolEnd.mockResolvedValue(undefined);
    mockShutdownGraceful.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes steps in correct order: job queue -> http close -> db close', async () => {
    const callOrder: string[] = [];

    mockShutdownGraceful.mockImplementation(async () => {
      callOrder.push('jobQueue.shutdownGraceful');
    });

    const server = {
      getConnections: vi.fn((cb: (err: Error | null, count: number) => void) => {
        cb(null, 0);
      }),
      close: vi.fn((cb: (err?: Error) => void) => {
        callOrder.push('httpServer.close');
        cb();
      }),
    } as unknown as Server;

    mockPoolEnd.mockImplementation(async () => {
      callOrder.push('pool.end');
    });

    await performGracefulShutdown(server, 'SIGTERM');

    expect(callOrder).toEqual([
      'jobQueue.shutdownGraceful',
      'httpServer.close',
      'pool.end',
    ]);
  });
});
