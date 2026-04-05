import { describe, expect, it } from 'vitest';

import {
  buildChatActionTrustReceipt,
  buildArduinoTrustReceipt,
  buildDesignAgentTrustReceipt,
  buildExportTrustReceipt,
  buildOrderingTrustReceipt,
  buildSerialTrustReceipt,
  buildSimulationTrustReceipt,
} from '@/lib/trust-receipts';
import type { ProjectExportData } from '@/lib/export-validation';

function makeExportData(overrides: Partial<ProjectExportData> = {}): ProjectExportData {
  return {
    projectName: 'ProtoPulse Rover',
    hasSession: true,
    architectureNodeCount: 3,
    hasCircuitInstances: true,
    hasPcbLayout: true,
    bomItemCount: 4,
    bomItemsWithPartNumber: 4,
    hasCircuitSource: true,
    hasCircuitComponent: true,
    hasBoardProfile: true,
    bomItemsWithFailureData: 0,
    ...overrides,
  };
}

describe('buildSimulationTrustReceipt', () => {
  it('returns setup-required guidance when no circuit is available', () => {
    const receipt = buildSimulationTrustReceipt({
      analysisType: 'dcop',
      autoDetected: null,
      circuitName: null,
      detection: null,
      error: null,
      hasCircuit: false,
      hasPlacedCircuitInstances: false,
      isCircuitLoading: false,
      resultsAvailable: false,
      cornerAnalysisEnabled: false,
    });

    expect(receipt.status).toBe('setup_required');
    expect(receipt.label).toBe('Setup required');
    expect(receipt.summary).toContain('needs a real circuit design');
  });

  it('returns fallback guidance for mixed, low-confidence topologies', () => {
    const receipt = buildSimulationTrustReceipt({
      analysisType: 'ac',
      autoDetected: {
        recommended: 'dcop',
        reason: 'Only DC sources detected',
        hasACSources: false,
        hasTransientSources: false,
        hasDCSources: true,
      },
      circuitName: 'Power Rail Check',
      detection: {
        type: 'mixed',
        confidence: 0.42,
        reason: 'Mixed domain hints',
      },
      error: null,
      hasCircuit: true,
      hasPlacedCircuitInstances: true,
      isCircuitLoading: false,
      resultsAvailable: true,
      cornerAnalysisEnabled: false,
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Fallback');
    expect(receipt.warnings?.some((warning) => warning.includes('fallback'))).toBe(true);
  });

  it('returns model-limited guidance after a confident run', () => {
    const receipt = buildSimulationTrustReceipt({
      analysisType: 'transient',
      autoDetected: {
        recommended: 'transient',
        reason: 'Pulse source detected',
        hasACSources: false,
        hasTransientSources: true,
        hasDCSources: false,
      },
      circuitName: 'Blink Driver',
      detection: {
        type: 'transient',
        confidence: 0.91,
        reason: 'Pulse source',
      },
      error: null,
      hasCircuit: true,
      hasPlacedCircuitInstances: true,
      isCircuitLoading: false,
      resultsAvailable: true,
      cornerAnalysisEnabled: false,
    });

    expect(receipt.label).toBe('Model-limited');
    expect(receipt.summary).toContain('relative design iteration');
  });
});

describe('buildExportTrustReceipt', () => {
  it('returns setup-required guidance when no session exists', () => {
    const receipt = buildExportTrustReceipt({
      selectedCircuitName: 'Main Board',
      availableCircuitCount: 1,
      buildProfileCount: 0,
      exportData: makeExportData({ hasSession: false }),
      validationResults: {
        kicad: { format: 'kicad', canExport: false, warnings: [], errors: ['Not authenticated'], suggestions: [] },
      },
    });

    expect(receipt.status).toBe('setup_required');
    expect(receipt.label).toBe('Session required');
  });

  it('returns ready-for-handoff when every tracked format passes', () => {
    const receipt = buildExportTrustReceipt({
      selectedCircuitName: 'Main Board',
      availableCircuitCount: 1,
      buildProfileCount: 2,
      exportData: makeExportData(),
      validationResults: {
        kicad: { format: 'kicad', canExport: true, warnings: [], errors: [], suggestions: [] },
        gerber: { format: 'gerber', canExport: true, warnings: [], errors: [], suggestions: [] },
      },
    });

    expect(receipt.status).toBe('ready');
    expect(receipt.label).toBe('Ready for handoff');
    expect(receipt.summary).toContain('All 2 tracked export formats');
  });

  it('returns caution when fabrication data is still missing', () => {
    const receipt = buildExportTrustReceipt({
      selectedCircuitName: 'Main Board',
      availableCircuitCount: 2,
      buildProfileCount: 0,
      exportData: makeExportData({ hasPcbLayout: false, bomItemsWithPartNumber: 2 }),
      validationResults: {
        gerber: { format: 'gerber', canExport: false, warnings: [], errors: ['No PCB layout'], suggestions: [] },
        firmware: { format: 'firmware', canExport: true, warnings: ['No board profile'], errors: [], suggestions: [] },
      },
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Local preflight only');
    expect(receipt.warnings?.some((warning) => warning.includes('selected circuit only'))).toBe(true);
    expect(receipt.warnings?.some((warning) => warning.includes('Firmware scaffold'))).toBe(true);
  });
});

describe('buildOrderingTrustReceipt', () => {
  it('starts in manual-spec mode before a fab is selected', () => {
    const receipt = buildOrderingTrustReceipt({
      compatibleFabCount: 4,
      dfmResult: null,
      quotes: [],
      selectedFabName: null,
      totalFabCount: 5,
    });

    expect(receipt.status).toBe('setup_required');
    expect(receipt.label).toBe('Manual spec');
  });

  it('blocks preflight when DFM fails', () => {
    const receipt = buildOrderingTrustReceipt({
      compatibleFabCount: 2,
      dfmResult: {
        passed: false,
        fabricator: 'jlcpcb',
        issues: [
          { severity: 'error', rule: 'min-trace', message: 'Trace width too small', actual: 0.08, required: 0.09, unit: 'mm' },
        ],
        timestamp: Date.now(),
      },
      quotes: [],
      selectedFabName: 'JLCPCB',
      totalFabCount: 5,
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Preflight blocked');
    expect(receipt.nextStep).toContain('Resolve the DFM errors');
  });

  it('becomes quote-ready after a passed DFM with quotes', () => {
    const receipt = buildOrderingTrustReceipt({
      compatibleFabCount: 3,
      dfmResult: {
        passed: true,
        fabricator: 'jlcpcb',
        issues: [],
        timestamp: Date.now(),
      },
      quotes: [
        {
          fabricator: 'jlcpcb',
          quantity: 5,
          unitPrice: 2,
          totalPrice: 10,
          setupFee: 0,
          shippingCost: 5,
          grandTotal: 15,
          turnaround: 'standard',
          turnaroundDays: 3,
          currency: 'USD',
          validUntil: Date.now() + 1000,
          breakdown: [],
        },
      ],
      selectedFabName: 'JLCPCB',
      totalFabCount: 5,
    });

    expect(receipt.label).toBe('Quote-ready');
    expect(receipt.summary).toContain('quote coverage');
  });
});

describe('buildArduinoTrustReceipt', () => {
  it('requires setup when the CLI and profile are missing', () => {
    const receipt = buildArduinoTrustReceipt({
      activeFilePath: null,
      activeJob: undefined,
      healthStatus: 'offline',
      selectedProfile: undefined,
      workspace: undefined,
    });

    expect(receipt.status).toBe('setup_required');
    expect(receipt.label).toBe('Profile required');
    expect(receipt.summary).toContain('toolchain and board context');
  });

  it('returns compile-only guidance when the board has no port', () => {
    const receipt = buildArduinoTrustReceipt({
      activeFilePath: 'Blink.ino',
      activeJob: undefined,
      devicePreflight: null,
      healthStatus: 'ok',
      selectedProfile: {
        id: 1,
        projectId: 1,
        name: 'Uno',
        profileName: null,
        fqbn: 'arduino:avr:uno',
        port: null,
        protocol: 'serial',
        boardOptions: {},
        portConfig: {},
        libOverrides: {},
        verboseCompile: false,
        verboseUpload: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      workspace: {
        id: 1,
        projectId: 1,
        rootPath: '/tmp/proto',
        activeSketchPath: 'Blink.ino',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Compile only');
    expect(receipt.warnings?.some((warning) => warning.includes('no serial port'))).toBe(true);
  });

  it('returns board-ready guidance when toolchain, sketch, and port exist', () => {
    const receipt = buildArduinoTrustReceipt({
      activeFilePath: 'Blink.ino',
      activeJob: undefined,
      devicePreflight: {
        status: 'matched',
        shouldBlockUpload: false,
        blockerReason: null,
        detectedDeviceLabel: 'Arduino Uno on /dev/ttyUSB0',
        portSafetyLabel: 'Matched',
        warnings: [],
      },
      healthStatus: 'ok',
      selectedProfile: {
        id: 1,
        projectId: 1,
        name: 'Uno',
        profileName: null,
        fqbn: 'arduino:avr:uno',
        port: '/dev/ttyUSB0',
        protocol: 'serial',
        boardOptions: {},
        portConfig: {},
        libOverrides: {},
        verboseCompile: false,
        verboseUpload: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      workspace: {
        id: 1,
        projectId: 1,
        rootPath: '/tmp/proto',
        activeSketchPath: 'Blink.ino',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(receipt.status).toBe('ready');
    expect(receipt.label).toBe('Board ready');
  });

  it('returns check-device guidance when the detected board does not match the selected profile', () => {
    const receipt = buildArduinoTrustReceipt({
      activeFilePath: 'Blink.ino',
      activeJob: undefined,
      devicePreflight: {
        status: 'board_mismatch',
        shouldBlockUpload: true,
        blockerReason: 'The selected profile (arduino:avr:uno) does not match the detected board (arduino:avr:mega) on /dev/ttyUSB0.',
        detectedDeviceLabel: 'Arduino Mega on /dev/ttyUSB0',
        portSafetyLabel: 'Board mismatch',
        warnings: ['The detected board identity disagrees with the selected build profile, so upload is blocked until they match.'],
      },
      healthStatus: 'ok',
      selectedProfile: {
        id: 1,
        projectId: 1,
        name: 'Uno',
        profileName: null,
        fqbn: 'arduino:avr:uno',
        port: '/dev/ttyUSB0',
        protocol: 'serial',
        boardOptions: {},
        portConfig: {},
        libOverrides: {},
        verboseCompile: false,
        verboseUpload: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      workspace: {
        id: 1,
        projectId: 1,
        rootPath: '/tmp/proto',
        activeSketchPath: 'Blink.ino',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Check board');
    expect(receipt.summary).toContain('does not match the detected board');
  });
});

describe('buildSerialTrustReceipt', () => {
  it('returns setup-required guidance before a device is connected', () => {
    const receipt = buildSerialTrustReceipt({
      baudRate: 115200,
      bytesReceived: 0,
      bytesSent: 0,
      connectionState: 'disconnected',
      devicePreflight: null,
      error: null,
      isSupported: true,
      portInfo: null,
      selectedBoardProfile: '',
      showTroubleshootHint: false,
    });

    expect(receipt.status).toBe('setup_required');
    expect(receipt.label).toBe('No device');
  });

  it('returns waiting-for-rx guidance when the device is connected but silent', () => {
    const receipt = buildSerialTrustReceipt({
      baudRate: 115200,
      bytesReceived: 0,
      bytesSent: 12,
      connectionState: 'connected',
      devicePreflight: {
        status: 'matched',
        blockerReason: null,
        boardSafetyLabel: 'Matched to Arduino profile',
        detectedDeviceLabel: 'Arduino Uno',
        arduinoProfileLabel: 'Arduino Uno Profile',
        warnings: [],
      },
      error: null,
      isSupported: true,
      portInfo: { usbVendorId: 0x2341, usbProductId: 0x0043 },
      selectedBoardProfile: 'Arduino Uno/Mega (ATmega16U2)',
      showTroubleshootHint: true,
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Waiting for RX');
    expect(receipt.warnings?.some((warning) => warning.includes('10 seconds'))).toBe(true);
  });

  it('returns live-session guidance when traffic is flowing', () => {
    const receipt = buildSerialTrustReceipt({
      baudRate: 115200,
      bytesReceived: 420,
      bytesSent: 80,
      connectionState: 'connected',
      devicePreflight: {
        status: 'matched',
        blockerReason: null,
        boardSafetyLabel: 'Matched to Arduino profile',
        detectedDeviceLabel: 'Arduino Uno',
        arduinoProfileLabel: 'Arduino Uno Profile',
        warnings: [],
      },
      error: null,
      isSupported: true,
      portInfo: { usbVendorId: 0x2341, usbProductId: 0x0043 },
      selectedBoardProfile: 'Arduino Uno/Mega (ATmega16U2)',
      showTroubleshootHint: false,
    });

    expect(receipt.status).toBe('ready');
    expect(receipt.label).toBe('Live session');
  });

  it('returns check-board guidance when the connected device disagrees with the Arduino profile', () => {
    const receipt = buildSerialTrustReceipt({
      baudRate: 115200,
      bytesReceived: 420,
      bytesSent: 24,
      connectionState: 'connected',
      devicePreflight: {
        status: 'profile_mismatch',
        blockerReason: 'The connected device identifies as ESP32 Dev Module, but the active Arduino profile targets Arduino Uno Profile.',
        boardSafetyLabel: 'Profile mismatch',
        detectedDeviceLabel: 'ESP32 Dev Module',
        arduinoProfileLabel: 'Arduino Uno Profile',
        warnings: ['Selected board differs from the connected device.'],
      },
      error: null,
      isSupported: true,
      portInfo: { usbVendorId: 0x303a },
      selectedBoardProfile: '',
      showTroubleshootHint: false,
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Check board');
    expect(receipt.summary).toContain('active Arduino profile');
    expect(receipt.facts?.some((fact) => fact.label === 'Board safety' && fact.value === 'Profile mismatch')).toBe(true);
  });
});

describe('buildDesignAgentTrustReceipt', () => {
  it('blocks the agent when the project session is missing', () => {
    const receipt = buildDesignAgentTrustReceipt({
      apiKeyValid: true,
      connectionStatus: 'connected',
      hasApiKey: true,
      hasSession: false,
      isReconnecting: false,
      isRunning: false,
      previewAiChanges: true,
      reviewPendingCount: 0,
      reviewThreshold: 50,
      safetyModeEnabled: true,
      strongestSafetyClassification: 'destructive',
    });

    expect(receipt.status).toBe('setup_required');
    expect(receipt.label).toBe('Session required');
  });

  it('warns when the agent would apply changes directly', () => {
    const receipt = buildDesignAgentTrustReceipt({
      apiKeyValid: true,
      connectionStatus: 'connected',
      hasApiKey: true,
      hasSession: true,
      isReconnecting: false,
      isRunning: false,
      previewAiChanges: false,
      reviewPendingCount: 0,
      reviewThreshold: 50,
      safetyModeEnabled: false,
      strongestSafetyClassification: 'safe',
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Direct apply');
  });

  it('returns review-first guidance when preview and safety are enabled', () => {
    const receipt = buildDesignAgentTrustReceipt({
      apiKeyValid: true,
      connectionStatus: 'connected',
      hasApiKey: true,
      hasSession: true,
      isReconnecting: false,
      isRunning: false,
      previewAiChanges: true,
      reviewPendingCount: 0,
      reviewThreshold: 50,
      safetyModeEnabled: true,
      strongestSafetyClassification: 'destructive',
    });

    expect(receipt.status).toBe('ready');
    expect(receipt.label).toBe('Review-first');
  });
});

describe('buildChatActionTrustReceipt', () => {
  it('warns when a proposal has no sources', () => {
    const receipt = buildChatActionTrustReceipt({
      actionCount: 2,
      confidenceScore: 72,
      previewAiChanges: true,
      reviewPendingCount: 0,
      reviewThreshold: 50,
      safetyModeEnabled: true,
      sourceCount: 0,
      strongestSafetyClassification: 'caution',
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Source-light');
  });

  it('warns when a proposal is below the review threshold', () => {
    const receipt = buildChatActionTrustReceipt({
      actionCount: 1,
      confidenceScore: 32,
      previewAiChanges: true,
      reviewPendingCount: 1,
      reviewThreshold: 50,
      safetyModeEnabled: true,
      sourceCount: 2,
      strongestSafetyClassification: 'safe',
    });

    expect(receipt.status).toBe('caution');
    expect(receipt.label).toBe('Low confidence');
    expect(receipt.nextStep).toContain('more evidence');
  });

  it('returns review-first guidance for grounded proposals', () => {
    const receipt = buildChatActionTrustReceipt({
      actionCount: 3,
      confidenceScore: 86,
      previewAiChanges: true,
      reviewPendingCount: 0,
      reviewThreshold: 50,
      safetyModeEnabled: true,
      sourceCount: 3,
      strongestSafetyClassification: 'caution',
    });

    expect(receipt.status).toBe('ready');
    expect(receipt.label).toBe('Review-first');
  });
});
