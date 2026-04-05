import { describe, expect, it } from 'vitest';

import { buildHardwareWorkspaceStatusSummary } from '@/lib/hardware-workspace-status';
import type { ArduinoJob } from '@shared/schema';

function buildJob(overrides: Partial<ArduinoJob> = {}): ArduinoJob {
  return {
    id: 1,
    projectId: 7,
    profileId: null,
    jobType: 'upload',
    status: 'running',
    command: 'arduino-cli upload',
    args: {},
    summary: 'Uploading',
    log: '',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    errorCode: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('buildHardwareWorkspaceStatusSummary', () => {
  it('warns when no default board profile exists', () => {
    const summary = buildHardwareWorkspaceStatusSummary({
      activeJob: null,
      connectionState: 'disconnected',
      defaultProfileName: null,
      defaultProfilePort: null,
      healthStatus: 'ok',
      healthSupported: true,
      portInfo: null,
      profileCount: 0,
      serialError: null,
      workspaceReady: true,
    });

    expect(summary.badgeLabel).toBe('Need board profile');
    expect(summary.actionView).toBe('arduino');
    expect(summary.tone).toBe('warning');
  });

  it('reports a ready hardware setup when a profile and port exist', () => {
    const summary = buildHardwareWorkspaceStatusSummary({
      activeJob: null,
      connectionState: 'disconnected',
      defaultProfileName: 'Workbench Uno',
      defaultProfilePort: '/dev/ttyUSB0',
      healthStatus: 'ok',
      healthSupported: true,
      portInfo: null,
      profileCount: 1,
      serialError: null,
      workspaceReady: true,
    });

    expect(summary.badgeLabel).toBe('Hardware ready');
    expect(summary.summary).toContain('Workbench Uno');
    expect(summary.tone).toBe('ready');
  });

  it('warns when a live device is connected without a board profile', () => {
    const summary = buildHardwareWorkspaceStatusSummary({
      activeJob: null,
      connectionState: 'connected',
      defaultProfileName: null,
      defaultProfilePort: null,
      healthStatus: 'ok',
      healthSupported: true,
      portInfo: { usbVendorId: 0x2341, usbProductId: 0x0043 },
      profileCount: 0,
      serialError: null,
      workspaceReady: true,
    });

    expect(summary.badgeLabel).toBe('Device live');
    expect(summary.actionView).toBe('serial_monitor');
    expect(summary.tone).toBe('warning');
  });

  it('prioritizes active firmware jobs over passive readiness', () => {
    const summary = buildHardwareWorkspaceStatusSummary({
      activeJob: buildJob(),
      connectionState: 'disconnected',
      defaultProfileName: 'Workbench Uno',
      defaultProfilePort: '/dev/ttyUSB0',
      healthStatus: 'ok',
      healthSupported: true,
      portInfo: null,
      profileCount: 1,
      serialError: null,
      workspaceReady: true,
    });

    expect(summary.badgeLabel).toBe('Hardware busy');
    expect(summary.summary).toContain('job in progress');
    expect(summary.tone).toBe('working');
  });
});
