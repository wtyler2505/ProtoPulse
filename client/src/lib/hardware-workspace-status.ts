import { useMemo, useSyncExternalStore } from 'react';

import { useArduino } from '@/lib/contexts/arduino-context';
import { KNOWN_BOARD_FILTERS, WebSerialManager, type ConnectionState, type SerialPortInfo } from '@/lib/web-serial';
import type { ArduinoJob } from '@shared/schema';

type HardwareWorkspaceTone = 'setup' | 'warning' | 'ready' | 'live' | 'working';
type HardwareWorkspaceFactTone = 'neutral' | 'positive' | 'warning';

export interface HardwareWorkspaceFact {
  id: string;
  label: string;
  tone: HardwareWorkspaceFactTone;
}

export interface HardwareWorkspaceStatusSummary {
  actionLabel: string;
  actionView: 'arduino' | 'serial_monitor';
  badgeLabel: string;
  detail: string;
  facts: HardwareWorkspaceFact[];
  summary: string;
  tone: HardwareWorkspaceTone;
}

export interface BuildHardwareWorkspaceStatusInput {
  activeJob: ArduinoJob | null;
  connectionState: ConnectionState;
  defaultProfileName: string | null;
  defaultProfilePort: string | null;
  healthStatus: string | null;
  healthSupported: boolean;
  portInfo: SerialPortInfo | null;
  profileCount: number;
  serialError: string | null;
  workspaceReady: boolean;
}

function formatPortInfo(portInfo: SerialPortInfo | null): string {
  if (!portInfo?.usbVendorId) {
    return 'Not connected';
  }

  const match = KNOWN_BOARD_FILTERS.find((candidate) => (
    candidate.usbVendorId === portInfo.usbVendorId
      && (candidate.usbProductId === undefined || candidate.usbProductId === portInfo.usbProductId)
  ));
  if (match) {
    return match.label;
  }

  const vendor = `0x${portInfo.usbVendorId.toString(16).padStart(4, '0')}`;
  const product = portInfo.usbProductId !== undefined
    ? ` / 0x${portInfo.usbProductId.toString(16).padStart(4, '0')}`
    : '';
  return `USB ${vendor}${product}`;
}

export function getHardwareWorkspaceToneClasses(tone: HardwareWorkspaceTone): string {
  switch (tone) {
    case 'working':
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'live':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'ready':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
    case 'setup':
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

export function getHardwareWorkspaceFactClasses(tone: HardwareWorkspaceFactTone): string {
  switch (tone) {
    case 'positive':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'neutral':
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

export function buildHardwareWorkspaceStatusSummary({
  activeJob,
  connectionState,
  defaultProfileName,
  defaultProfilePort,
  healthStatus,
  healthSupported,
  portInfo,
  profileCount,
  serialError,
  workspaceReady,
}: BuildHardwareWorkspaceStatusInput): HardwareWorkspaceStatusSummary {
  const deviceLabel = formatPortInfo(portInfo);
  const jobLabel = activeJob ? `${activeJob.jobType} (${activeJob.status})` : 'Idle';
  const facts: HardwareWorkspaceFact[] = [
    {
      id: 'profile',
      label: defaultProfileName ? `Profile: ${defaultProfileName}` : `Profiles: ${String(profileCount)}`,
      tone: defaultProfileName ? 'positive' : 'warning',
    },
    {
      id: 'device',
      label: connectionState === 'connected' ? `Device: ${deviceLabel}` : 'Device: Not connected',
      tone: connectionState === 'connected' ? 'positive' : 'neutral',
    },
    {
      id: 'job',
      label: `Job: ${jobLabel}`,
      tone: activeJob ? 'positive' : 'neutral',
    },
  ];

  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
    return {
      actionLabel: 'Open Arduino',
      actionView: 'arduino',
      badgeLabel: 'Hardware busy',
      detail: `ProtoPulse is actively running a ${activeJob.jobType} job. Treat the Arduino console as the source of truth until it settles.`,
      facts,
      summary: `${activeJob.jobType === 'upload' ? 'Upload' : 'Firmware'} job in progress`,
      tone: 'working',
    };
  }

  if (!healthSupported || healthStatus !== 'ok' || !workspaceReady) {
    return {
      actionLabel: 'Open Arduino',
      actionView: 'arduino',
      badgeLabel: 'Hardware setup',
      detail: 'Arduino CLI or the project workspace is not fully ready yet, so hardware actions should still be treated as setup work.',
      facts,
      summary: 'Toolchain or workspace still needs setup',
      tone: 'setup',
    };
  }

  if (serialError) {
    return {
      actionLabel: 'Open Serial Monitor',
      actionView: 'serial_monitor',
      badgeLabel: 'Hardware warning',
      detail: serialError,
      facts,
      summary: 'Serial session reported a hardware warning',
      tone: 'warning',
    };
  }

  if (connectionState === 'connecting') {
    return {
      actionLabel: 'Open Serial Monitor',
      actionView: 'serial_monitor',
      badgeLabel: 'Connecting',
      detail: 'ProtoPulse is establishing a live serial session with the selected device.',
      facts,
      summary: 'Waiting for the board connection to settle',
      tone: 'working',
    };
  }

  if (connectionState === 'connected') {
    return {
      actionLabel: 'Open Serial Monitor',
      actionView: 'serial_monitor',
      badgeLabel: defaultProfileName ? 'Hardware live' : 'Device live',
      detail: defaultProfileName
        ? `A live serial session is attached and the project board profile is "${defaultProfileName}".`
        : 'A device is connected, but there is no Arduino board profile yet to anchor uploads or hardware-specific checks.',
      facts,
      summary: defaultProfileName ? 'Device connected and profile-aware' : 'Device connected without board profile',
      tone: defaultProfileName ? 'live' : 'warning',
    };
  }

  if (!defaultProfileName) {
    return {
      actionLabel: 'Set up hardware',
      actionView: 'arduino',
      badgeLabel: 'Need board profile',
      detail: 'Create a default Arduino board profile before treating compile, upload, or serial workflows as meaningful.',
      facts,
      summary: 'No default Arduino profile yet',
      tone: 'warning',
    };
  }

  if (!defaultProfilePort) {
    return {
      actionLabel: 'Finish profile',
      actionView: 'arduino',
      badgeLabel: 'Port needed',
      detail: `The default board profile "${defaultProfileName}" exists, but it still needs a target port before upload can be trusted.`,
      facts,
      summary: 'Board profile exists, but upload target is incomplete',
      tone: 'warning',
    };
  }

  return {
    actionLabel: 'Open Arduino',
    actionView: 'arduino',
    badgeLabel: 'Hardware ready',
    detail: `The project has a default board profile and upload port configured. Connect the device when you are ready to verify or monitor hardware live.`,
    facts,
    summary: `Board profile "${defaultProfileName}" is configured`,
    tone: 'ready',
  };
}

function useSerialConnectionStatus(): {
  connectionState: ConnectionState;
  portInfo: SerialPortInfo | null;
  serialError: string | null;
} {
  const manager = WebSerialManager.getInstance();
  const serialSignature = useSyncExternalStore(
    (callback) => manager.subscribe(callback),
    () => {
      const state = manager.getState();
      return [
        state.connectionState,
        state.portInfo?.usbVendorId ?? '',
        state.portInfo?.usbProductId ?? '',
        state.error ?? '',
      ].join('|');
    },
    () => 'disconnected|||',
  );

  return useMemo(() => {
    void serialSignature;
    const state = manager.getState();
    return {
      connectionState: state.connectionState,
      portInfo: state.portInfo,
      serialError: state.error,
    };
  }, [manager, serialSignature]);
}

export function useHardwareWorkspaceStatus(): HardwareWorkspaceStatusSummary {
  const { health, jobs, profiles, workspace } = useArduino();
  const { connectionState, portInfo, serialError } = useSerialConnectionStatus();

  const defaultProfile = useMemo(
    () => profiles.find((profile) => profile.isDefault) ?? profiles[0] ?? null,
    [profiles],
  );
  const activeJob = useMemo(
    () => jobs.find((job) => job.status === 'pending' || job.status === 'running') ?? null,
    [jobs],
  );

  return useMemo(
    () => buildHardwareWorkspaceStatusSummary({
      activeJob,
      connectionState,
      defaultProfileName: defaultProfile?.name?.trim() || null,
      defaultProfilePort: defaultProfile?.port?.trim() || null,
      healthStatus: health?.status ?? null,
      healthSupported: health?.supported ?? false,
      portInfo,
      profileCount: profiles.length,
      serialError,
      workspaceReady: Boolean(workspace),
    }),
    [
      activeJob,
      connectionState,
      defaultProfile,
      health?.status,
      health?.supported,
      portInfo,
      profiles.length,
      serialError,
      workspace,
    ],
  );
}
