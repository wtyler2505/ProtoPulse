export interface PendingStarterCircuitLaunch {
  id: string;
  name: string;
  arduinoCode: string;
  queuedAt: number;
}

export const PENDING_STARTER_CIRCUIT_LAUNCH_KEY = 'protopulse-pending-starter-circuit';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function queueStarterCircuitLaunch(
  launch: Omit<PendingStarterCircuitLaunch, 'queuedAt'>,
): boolean {
  const storage = getSessionStorage();
  if (!storage) {
    return false;
  }

  storage.setItem(
    PENDING_STARTER_CIRCUIT_LAUNCH_KEY,
    JSON.stringify({
      ...launch,
      queuedAt: Date.now(),
    } satisfies PendingStarterCircuitLaunch),
  );
  return true;
}

export function readPendingStarterCircuitLaunch(): PendingStarterCircuitLaunch | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(PENDING_STARTER_CIRCUIT_LAUNCH_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingStarterCircuitLaunch>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.arduinoCode !== 'string' ||
      typeof parsed.queuedAt !== 'number'
    ) {
      storage.removeItem(PENDING_STARTER_CIRCUIT_LAUNCH_KEY);
      return null;
    }

    return parsed as PendingStarterCircuitLaunch;
  } catch {
    storage.removeItem(PENDING_STARTER_CIRCUIT_LAUNCH_KEY);
    return null;
  }
}

export function consumePendingStarterCircuitLaunch(): PendingStarterCircuitLaunch | null {
  const storage = getSessionStorage();
  const pending = readPendingStarterCircuitLaunch();

  if (storage) {
    storage.removeItem(PENDING_STARTER_CIRCUIT_LAUNCH_KEY);
  }

  return pending;
}
