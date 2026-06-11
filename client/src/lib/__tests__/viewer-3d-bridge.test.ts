import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VIEWER_3D_BRIDGE_EVENT,
  VIEWER_3D_REPAIR_EVENT,
  buildViewer3DRepairExactPartSeed,
  publishViewer3DBridgeTarget,
  publishViewer3DRepairTarget,
  readViewer3DBridgeTarget,
  readViewer3DRepairTarget,
  writeViewer3DBridgeTarget,
  type Viewer3DBridgeTarget,
  type Viewer3DRepairTarget,
} from '@/lib/viewer-3d-bridge';
import {
  BREADBOARD_3D_BRIDGE_EVENT,
  publishBreadboard3DBridgeTarget,
  readBreadboard3DBridgeTarget,
  type Breadboard3DBridgeTarget,
} from '@/lib/breadboard-3d-bridge';

describe('viewer 3D bridge', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists and reads generic 3D targets', () => {
    const target: Viewer3DBridgeTarget = {
      sourceView: 'generative',
      sourceId: 'cand-1',
      title: 'Boost converter candidate',
      sourceName: 'Generative design engine',
      trustTier: 'ai-generated',
      verificationLevel: 'generated',
      verificationStatus: 'candidate',
      readyNow: false,
      componentCount: 3,
      generatedFrom: 'generative-design',
      fitnessScore: 0.91,
      createdAt: Date.now(),
    };

    writeViewer3DBridgeTarget(target);

    expect(readViewer3DBridgeTarget()).toMatchObject({
      sourceView: 'generative',
      title: 'Boost converter candidate',
      componentCount: 3,
      generatedFrom: 'generative-design',
      sourceName: 'Generative design engine',
      fitnessScore: 0.91,
    });
  });

  it('publishes the generic event and stores the payload', () => {
    const events: Viewer3DBridgeTarget[] = [];
    window.addEventListener(VIEWER_3D_BRIDGE_EVENT, (event) => {
      events.push((event as CustomEvent<Viewer3DBridgeTarget>).detail);
    });

    publishViewer3DBridgeTarget({
      sourceView: 'community',
      projectId: 9,
      sourceId: 'seed-dip8-3d',
      title: 'DIP-8 3D Package',
      sourceName: '3DModelPro',
      sourceTrustScore: 78,
      trustTier: 'community',
      verificationLevel: 'community-only',
      verificationStatus: 'candidate',
      readyNow: true,
      modelFormat: 'STEP',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sourceView: 'community',
      sourceName: '3DModelPro',
      sourceTrustScore: 78,
      modelFormat: 'STEP',
    });
    expect(readViewer3DBridgeTarget()).toMatchObject({
      sourceView: 'community',
      sourceId: 'seed-dip8-3d',
      sourceName: '3DModelPro',
      sourceTrustScore: 78,
    });
  });

  it('normalizes Digital Twin live-state fields', () => {
    publishViewer3DBridgeTarget({
      sourceView: 'digital-twin',
      projectId: 9,
      title: 'ESP32 telemetry',
      trustTier: 'live-telemetry',
      verificationLevel: 'live',
      verificationStatus: 'no-comparison',
      readyNow: true,
      channelCount: 3,
      liveChannelCount: 2,
      pinCount: 2,
      netCount: 1,
      healthStatus: 'warn',
      stateConfidence: 'live',
      modelKind: 'behavior-preview',
      liveChannels: [
        { id: 'A0', name: 'Sensor', value: '1.25V', state: 'live', pin: 36, unit: 'V', refDes: 'U1', pinLabel: 'A0', netName: 'SENSOR_OUT' },
        { id: 'PWM3', name: 'Motor PWM', value: '0.00', state: 'stale', pin: 3 },
        { id: '', name: 'Invalid', value: 'ignored', state: 'live' },
        { id: 'WAIT', name: 'Waiting', value: '', state: 'invalid' as never },
      ],
    });

    expect(readViewer3DBridgeTarget()).toMatchObject({
      sourceView: 'digital-twin',
      channelCount: 3,
      liveChannelCount: 2,
      pinCount: 2,
      netCount: 1,
      healthStatus: 'warn',
      stateConfidence: 'live',
      liveChannels: [
        { id: 'A0', name: 'Sensor', value: '1.25V', state: 'live', pin: 36, unit: 'V', refDes: 'U1', pinLabel: 'A0', netName: 'SENSOR_OUT' },
        { id: 'PWM3', name: 'Motor PWM', value: '0.00', state: 'stale', pin: 3 },
        { id: 'WAIT', name: 'Waiting', value: 'waiting', state: 'waiting' },
      ],
    });
  });

  it('publishes Digital Twin repair targets and builds exact-part seed text', () => {
    const events: Viewer3DRepairTarget[] = [];
    window.addEventListener(VIEWER_3D_REPAIR_EVENT, (event) => {
      events.push((event as CustomEvent<Viewer3DRepairTarget>).detail);
    });

    const target = publishViewer3DRepairTarget({
      sourceView: 'digital-twin',
      destination: 'component-editor',
      projectId: 42,
      refDes: 'U1',
      title: 'Button repair context',
      summary: '1/1 live channels · U1 pin-0 on BUTTON',
      trustTier: 'live-telemetry',
      verificationLevel: 'live',
      verificationStatus: 'warn',
      channelCount: 1,
      liveChannelCount: 1,
      pinCount: 1,
      netCount: 1,
      healthStatus: 'warn',
      stateConfidence: 'live',
      channel: {
        id: 'pin-0',
        name: 'Button',
        value: 'HIGH',
        state: 'live',
        refDes: 'U1',
        pinLabel: 'pin-0',
        netName: 'BUTTON',
      },
    });

    expect(events).toHaveLength(1);
    expect(readViewer3DRepairTarget()).toMatchObject({
      destination: 'component-editor',
      refDes: 'U1',
      channel: {
        id: 'pin-0',
        netName: 'BUTTON',
      },
    });
    expect(buildViewer3DRepairExactPartSeed(target)).toEqual({
      description: expect.stringContaining('Digital Twin repair context for U1.'),
    });
    expect(buildViewer3DRepairExactPartSeed(target).description).toContain('pin pin-0');
    expect(buildViewer3DRepairExactPartSeed(target).description).toContain('net BUTTON');
    expect(buildViewer3DRepairExactPartSeed(target).description).toContain('value HIGH');
  });

  it('persists Component Editor exact-part verification context', () => {
    publishViewer3DBridgeTarget({
      sourceView: 'component-editor',
      projectId: 42,
      sourceId: '17',
      title: 'Verified DIP-8 Op Amp',
      subtitle: 'Official-backed pin map from the Component Editor',
      trustTier: 'board-module',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
      pinMapConfidence: 'exact',
      readyNow: true,
      modelKind: 'breadboard',
      modelFormat: 'DIP-8',
    });

    expect(readViewer3DBridgeTarget()).toMatchObject({
      sourceView: 'component-editor',
      projectId: 42,
      sourceId: '17',
      title: 'Verified DIP-8 Op Amp',
      subtitle: 'Official-backed pin map from the Component Editor',
      trustTier: 'board-module',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
      pinMapConfidence: 'exact',
      readyNow: true,
      modelKind: 'breadboard',
      modelFormat: 'DIP-8',
    });
  });

  it('keeps the Breadboard compatibility event working', () => {
    const events: Breadboard3DBridgeTarget[] = [];
    window.addEventListener(BREADBOARD_3D_BRIDGE_EVENT, (event) => {
      events.push((event as CustomEvent<Breadboard3DBridgeTarget>).detail);
    });

    publishBreadboard3DBridgeTarget({
      sourceView: 'breadboard',
      projectId: 1,
      circuitId: 2,
      instanceId: 3,
      refDes: 'U1',
      title: 'ATmega328P DIP',
      trustTier: 'connector-defined',
      verificationLevel: 'community-only',
      verificationStatus: 'candidate',
      pinMapConfidence: 'exact',
      readyNow: true,
    });

    expect(events).toHaveLength(1);
    expect(readBreadboard3DBridgeTarget()).toMatchObject({
      sourceView: 'breadboard',
      refDes: 'U1',
      pinMapConfidence: 'exact',
    });
  });
});
