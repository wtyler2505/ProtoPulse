import type { SafetyClassification } from '@/lib/ai-safety-mode';
import type { ConnectionStatus } from '@/lib/auth-context';
import type { AutoDetectResult, SimulationTypeResult } from '@/lib/simulation/auto-detect';
import type { SerialPortInfo, ConnectionState } from '@/lib/web-serial';
import type { DfmCheckResult, PriceQuote } from '@/lib/pcb-ordering';
import type { ExportPreflightResult, ProjectExportData } from '@/lib/export-validation';
import type { TrustReceipt } from '@/lib/feature-maturity';
import type { ArduinoUploadTargetAssessment } from '@/lib/arduino/device-preflight';
import type { SerialDevicePreflightAssessment } from '@/lib/arduino/serial-device-preflight';
import type { ArduinoBuildProfile, ArduinoJob, ArduinoWorkspace } from '@shared/schema';

type SimulationAnalysisType = 'dcop' | 'transient' | 'ac' | 'dcsweep';

interface SimulationTrustInput {
  analysisType: SimulationAnalysisType;
  autoDetected: AutoDetectResult | null;
  circuitName?: string | null;
  detection: SimulationTypeResult | null;
  error?: string | null;
  hasCircuit: boolean;
  hasPlacedCircuitInstances: boolean;
  isCircuitLoading: boolean;
  resultsAvailable: boolean;
  cornerAnalysisEnabled: boolean;
}

interface ExportTrustInput {
  selectedCircuitName?: string | null;
  availableCircuitCount: number;
  buildProfileCount: number;
  exportData: ProjectExportData;
  validationResults: Record<string, ExportPreflightResult>;
}

interface OrderingTrustInput {
  compatibleFabCount: number;
  dfmResult: DfmCheckResult | null;
  quotes: PriceQuote[];
  selectedFabName?: string | null;
  totalFabCount: number;
}

interface ArduinoTrustInput {
  activeFilePath?: string | null;
  activeJob: ArduinoJob | undefined;
  devicePreflight?: ArduinoUploadTargetAssessment | null;
  healthStatus?: string | null;
  selectedProfile: ArduinoBuildProfile | undefined;
  workspace: ArduinoWorkspace | undefined;
}

interface SerialTrustInput {
  baudRate: number;
  bytesReceived: number;
  bytesSent: number;
  connectionState: ConnectionState;
  devicePreflight?: SerialDevicePreflightAssessment | null;
  error?: string | null;
  isSupported: boolean;
  portInfo: SerialPortInfo | null;
  selectedBoardProfile?: string | null;
  showTroubleshootHint: boolean;
}

interface DesignAgentTrustInput {
  apiKeyValid: boolean;
  connectionStatus: ConnectionStatus;
  hasApiKey: boolean;
  hasSession: boolean;
  isReconnecting: boolean;
  isRunning: boolean;
  previewAiChanges: boolean;
  reviewPendingCount: number;
  reviewThreshold: number;
  safetyModeEnabled: boolean;
  strongestSafetyClassification: SafetyClassification;
}

interface ChatActionTrustInput {
  actionCount: number;
  confidenceScore?: number;
  previewAiChanges: boolean;
  reviewPendingCount: number;
  reviewThreshold: number;
  safetyModeEnabled: boolean;
  sourceCount: number;
  strongestSafetyClassification: SafetyClassification;
}

function formatAnalysisLabel(analysisType: SimulationAnalysisType): string {
  switch (analysisType) {
    case 'dcop':
      return 'DC Operating Point';
    case 'transient':
      return 'Transient';
    case 'ac':
      return 'AC Sweep';
    case 'dcsweep':
      return 'DC Sweep';
  }
}

function formatRecommendedAnalysis(analysisType: SimulationAnalysisType): string {
  switch (analysisType) {
    case 'dcop':
      return 'DC operating point';
    case 'transient':
      return 'transient';
    case 'ac':
      return 'AC sweep';
    case 'dcsweep':
      return 'DC sweep';
  }
}

function formatDetectedDomain(type: SimulationTypeResult['type']): string {
  switch (type) {
    case 'dc':
      return 'DC';
    case 'ac':
      return 'AC';
    case 'transient':
      return 'Transient';
    case 'mixed':
      return 'Mixed';
  }
}

function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined || Number.isNaN(confidence)) {
    return 'Unavailable';
  }
  return `${Math.round(confidence * 100)}%`;
}

function formatUsbId(id: number | undefined): string {
  if (id === undefined) {
    return 'Unknown';
  }
  return `0x${id.toString(16).padStart(4, '0').toUpperCase()}`;
}

function formatPortInfo(portInfo: SerialPortInfo | null): string {
  if (!portInfo) {
    return 'Not connected';
  }

  const parts: string[] = [];
  if (portInfo.usbVendorId !== undefined) {
    parts.push(`VID ${formatUsbId(portInfo.usbVendorId)}`);
  }
  if (portInfo.usbProductId !== undefined) {
    parts.push(`PID ${formatUsbId(portInfo.usbProductId)}`);
  }

  return parts.length > 0 ? parts.join(' / ') : 'Connected';
}

export function buildSimulationTrustReceipt({
  analysisType,
  autoDetected,
  circuitName,
  detection,
  error,
  hasCircuit,
  hasPlacedCircuitInstances,
  isCircuitLoading,
  resultsAvailable,
  cornerAnalysisEnabled,
}: SimulationTrustInput): TrustReceipt {
  const facts = [
    { label: 'Circuit', value: circuitName?.trim() || 'Selected circuit' },
    { label: 'Analysis', value: formatAnalysisLabel(analysisType) },
    {
      label: 'Detection',
      value: detection ? `${formatDetectedDomain(detection.type)} (${formatConfidence(detection.confidence)})` : 'Unavailable',
    },
  ];

  if (!hasCircuit) {
    return {
      title: 'Simulation trust ladder',
      status: 'setup_required',
      label: 'Setup required',
      summary: 'ProtoPulse needs a real circuit design before any simulation guidance is meaningful.',
      facts,
      warnings: [
        'No circuit design is selected yet, so there is nothing trustworthy to analyze.',
      ],
      nextStep: 'Create or select a circuit, then place components before running a simulation.',
    };
  }

  if (isCircuitLoading) {
    return {
      title: 'Simulation trust ladder',
      status: 'setup_required',
      label: 'Loading context',
      summary: 'Circuit data is still loading, so the trust ladder cannot score this run yet.',
      facts,
      warnings: [
        'Wait for circuit instances to finish loading before relying on the run button or result state.',
      ],
      nextStep: 'Let the circuit load completely, then rerun the simulation.',
    };
  }

  if (!hasPlacedCircuitInstances) {
    return {
      title: 'Simulation trust ladder',
      status: 'setup_required',
      label: 'Need components',
      summary: 'Simulation is blocked until the selected circuit has at least one placed component.',
      facts,
      warnings: [
        'An empty circuit cannot produce trustworthy SPICE guidance.',
      ],
      nextStep: 'Place components in the schematic, then add at least one source before running.',
    };
  }

  const warnings: string[] = [];
  const hasAnySource = Boolean(
    autoDetected?.hasACSources || autoDetected?.hasDCSources || autoDetected?.hasTransientSources,
  );
  const detectionConfidence = detection?.confidence ?? 0;
  const analysisMatchesRecommendation = autoDetected ? autoDetected.recommended === analysisType : true;

  if (!hasAnySource) {
    warnings.push('No voltage or current source is detected, so the solver may produce minimal or misleading output.');
  }
  if (autoDetected && !analysisMatchesRecommendation) {
    warnings.push(
      `This run uses ${formatRecommendedAnalysis(analysisType)}, but the circuit topology currently points toward ${formatRecommendedAnalysis(autoDetected.recommended)} analysis.`,
    );
  }
  if (detection?.type === 'mixed' || detectionConfidence < 0.7) {
    warnings.push('The circuit topology looks mixed or low-confidence, so treat this run as a fallback guide instead of a sign-off result.');
  }
  if (cornerAnalysisEnabled) {
    warnings.push('Corner sweeps are useful for comparison, but they still depend on simplified component models and assumptions.');
  }
  if (error) {
    warnings.push(`Latest run error: ${error}`);
  }
  warnings.push('ProtoPulse simulation is still best for learning and relative design iteration, not final hardware sign-off.');

  if (!hasAnySource || detection?.type === 'mixed' || detectionConfidence < 0.7 || Boolean(error)) {
    return {
      title: 'Simulation trust ladder',
      status: 'caution',
      label: 'Fallback',
      summary: 'Use this surface as low-confidence guidance for understanding the circuit, not as proof that the design is ready for hardware decisions.',
      facts,
      warnings,
      nextStep: 'Add clear stimulus sources, align the analysis type with the circuit topology, and verify critical behavior with an external reference before trusting the result.',
    };
  }

  if (!resultsAvailable) {
    return {
      title: 'Simulation trust ladder',
      status: 'caution',
      label: 'Learning-grade',
      summary: 'The selected circuit looks simulatable, but you have not produced a result yet. Treat the next run as exploratory learning and comparison guidance.',
      facts,
      warnings,
      nextStep: 'Run the recommended analysis, then compare the output against expected voltages, currents, or frequencies.',
    };
  }

  return {
    title: 'Simulation trust ladder',
    status: 'caution',
    label: 'Model-limited',
    summary: 'This run is strong enough for relative design iteration, but the output still depends on simplified models, selected sources, and local project state.',
    facts,
    warnings,
    nextStep: 'Use the result to compare options, then export SPICE or bench-test the design before making manufacturing or hardware commitments.',
  };
}

export function buildExportTrustReceipt({
  selectedCircuitName,
  availableCircuitCount,
  buildProfileCount,
  exportData,
  validationResults,
}: ExportTrustInput): TrustReceipt {
  const totalFormats = Object.keys(validationResults).length;
  const readyFormats = Object.values(validationResults).filter((result) => result.canExport).length;
  const blockedFormats = totalFormats - readyFormats;
  const selectedCircuitLabel = selectedCircuitName?.trim() || 'Selected circuit';

  const facts = [
    { label: 'Circuit', value: selectedCircuitLabel },
    { label: 'Formats ready', value: `${readyFormats} / ${totalFormats}` },
    { label: 'PCB placed', value: exportData.hasPcbLayout ? 'Yes' : 'No' },
    { label: 'Build profiles', value: buildProfileCount > 0 ? String(buildProfileCount) : 'None' },
  ];

  const warnings: string[] = [];
  if (!exportData.hasSession) {
    warnings.push('Server-backed export routes require a valid ProtoPulse session.');
  }
  if (availableCircuitCount > 1) {
    warnings.push(`Preflight currently reflects the selected circuit only: ${selectedCircuitLabel}.`);
  }
  if (!exportData.hasCircuitInstances) {
    warnings.push('The selected circuit has no placed instances yet, so schematic and netlist exports will stay thin or blocked.');
  }
  if (!exportData.hasPcbLayout) {
    warnings.push('Fabrication and 3D exports stay blocked until the selected circuit has PCB placement data.');
  }
  if (exportData.bomItemCount > 0 && exportData.bomItemsWithPartNumber < exportData.bomItemCount) {
    warnings.push('Some BOM items still lack part numbers, so assembly handoff files will remain incomplete.');
  }
  if (buildProfileCount === 0) {
    warnings.push('Firmware scaffold can export, but it will stay generic until at least one Arduino build profile exists.');
  }

  if (!exportData.hasSession) {
    return {
      title: 'Export preflight receipt',
      status: 'setup_required',
      label: 'Session required',
      summary: 'The export matrix cannot be trusted until ProtoPulse has a valid session for server-backed generation.',
      facts,
      warnings,
      nextStep: 'Re-authenticate, then rerun preflight before trusting any generated files.',
    };
  }

  if (blockedFormats === 0) {
    return {
      title: 'Export preflight receipt',
      status: 'ready',
      label: 'Ready for handoff',
      summary: `All ${totalFormats} tracked export formats currently pass local preflight for ${selectedCircuitLabel}.`,
      facts,
      warnings,
      nextStep: 'Run the per-format precheck before sharing files with a fab, teammate, or firmware workflow.',
    };
  }

  return {
    title: 'Export preflight receipt',
    status: 'caution',
    label: 'Local preflight only',
    summary: `${readyFormats} of ${totalFormats} tracked export formats currently pass local preflight for ${selectedCircuitLabel}; the rest are still blocked or partially trusted.`,
    facts,
    warnings,
    nextStep: 'Fill the missing circuit, PCB, BOM, or build-profile data, then rerun prechecks before trusting manufacturing or firmware handoff outputs.',
  };
}

export function buildOrderingTrustReceipt({
  compatibleFabCount,
  dfmResult,
  quotes,
  selectedFabName,
  totalFabCount,
}: OrderingTrustInput): TrustReceipt {
  const errorCount = dfmResult?.issues.filter((issue) => issue.severity === 'error').length ?? 0;
  const warningCount = dfmResult?.issues.filter((issue) => issue.severity === 'warning').length ?? 0;

  const facts = [
    { label: 'Spec source', value: 'Manual form' },
    { label: 'Compatible fabs', value: `${compatibleFabCount} / ${totalFabCount}` },
    {
      label: 'DFM',
      value: dfmResult
        ? dfmResult.passed
          ? `Passed${warningCount > 0 ? ` (${warningCount} warn)` : ''}`
          : `${errorCount} error${errorCount === 1 ? '' : 's'}`
        : 'Not run',
    },
    { label: 'Quotes', value: quotes.length > 0 ? String(quotes.length) : 'None' },
  ];

  const warnings = [
    'Board specs here are still manual planning inputs, not a guaranteed extract from the live PCB editor.',
    'DFM and quote results are guidance only until they are cross-checked against generated manufacturing files.',
  ];

  if (selectedFabName) {
    warnings.unshift(`Current preflight target: ${selectedFabName}.`);
  }
  if (compatibleFabCount < totalFabCount) {
    warnings.push('Not every listed fab supports the current stackup and special-feature mix.');
  }

  if (!selectedFabName) {
    return {
      title: 'Manufacturing preflight receipt',
      status: 'setup_required',
      label: 'Manual spec',
      summary: 'This ordering flow starts as a planning worksheet. Pick a fabricator before treating any price or manufacturability signal as meaningful.',
      facts,
      warnings,
      nextStep: 'Review the board spec, then choose a compatible fab to unlock DFM preflight.',
    };
  }

  if (!dfmResult) {
    return {
      title: 'Manufacturing preflight receipt',
      status: 'setup_required',
      label: 'Run DFM',
      summary: 'A fabricator is selected, but manufacturability has not been checked yet for the current spec.',
      facts,
      warnings,
      nextStep: 'Run DFM before trusting the quote stage or treating the board as ready to order.',
    };
  }

  if (!dfmResult.passed) {
    return {
      title: 'Manufacturing preflight receipt',
      status: 'caution',
      label: 'Preflight blocked',
      summary: 'The current manual board spec is failing DFM, so ProtoPulse should be treated as a warning surface rather than an ordering surface right now.',
      facts,
      warnings,
      nextStep: 'Resolve the DFM errors, then rerun preflight before comparing quotes.',
    };
  }

  return {
    title: 'Manufacturing preflight receipt',
    status: 'caution',
    label: quotes.length > 0 ? 'Quote-ready' : 'DFM passed',
    summary: quotes.length > 0
      ? 'The current spec passes DFM and has quote coverage, but it still needs a final cross-check against exported manufacturing files before purchase.'
      : 'The current spec passes DFM, but quotes have not been generated yet and the board is still not in final sign-off territory.',
    facts,
    warnings,
    nextStep: quotes.length > 0
      ? 'Compare the quote set, then validate the actual fab package before submitting any real order.'
      : 'Generate quotes next, then compare them against the final exported fab package.',
  };
}

export function buildArduinoTrustReceipt({
  activeFilePath,
  activeJob,
  devicePreflight,
  healthStatus,
  selectedProfile,
  workspace,
}: ArduinoTrustInput): TrustReceipt {
  const hasPort = Boolean(selectedProfile?.port?.trim());
  const activeJobLabel = activeJob ? `${activeJob.jobType} (${activeJob.status})` : 'Idle';

  const facts = [
    { label: 'CLI', value: healthStatus === 'ok' ? 'Connected' : 'Offline' },
    { label: 'Workspace', value: workspace ? 'Provisioned' : 'Provisioning' },
    { label: 'Board profile', value: selectedProfile?.name?.trim() || 'None selected' },
    { label: 'Port', value: selectedProfile?.port?.trim() || 'Not set' },
    { label: 'Detected device', value: devicePreflight?.detectedDeviceLabel ?? 'Not checked yet' },
    { label: 'Port safety', value: devicePreflight?.portSafetyLabel ?? 'Not checked yet' },
    { label: 'Sketch', value: activeFilePath?.trim() || 'No file open' },
    { label: 'Active job', value: activeJobLabel },
  ];

  const warnings: string[] = [];
  if (healthStatus !== 'ok') {
    warnings.push('Arduino CLI is offline, so verify/upload results are not trustworthy yet.');
  }
  if (!workspace) {
    warnings.push('The project workbench is still provisioning its Arduino workspace.');
  }
  if (!selectedProfile) {
    warnings.push('Choose or create a board profile before treating compile/upload controls as meaningful.');
  }
  if (selectedProfile && !hasPort) {
    warnings.push('This profile has no serial port configured, so upload is still blocked even if compile is available.');
  }
  if (!activeFilePath) {
    warnings.push('Open or create a sketch before running Verify or Upload.');
  }
  if (devicePreflight?.warnings?.length) {
    warnings.push(...devicePreflight.warnings);
  }
  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
    warnings.push('A firmware job is already active, so wait for it to finish before trusting a second compile/upload click.');
  }

  if (healthStatus !== 'ok' || !workspace || !selectedProfile) {
    return {
      title: 'Arduino readiness',
      status: 'setup_required',
      label: !selectedProfile ? 'Profile required' : 'Setup required',
      summary: 'The Arduino workbench is present, but toolchain and board context still need to be completed before firmware actions are trustworthy.',
      facts,
      warnings,
      nextStep: 'Connect Arduino CLI, confirm the workspace is provisioned, and pick a board profile before compiling or uploading.',
    };
  }

  if (!activeFilePath) {
    return {
      title: 'Arduino readiness',
      status: 'caution',
      label: 'Need sketch',
      summary: 'Board context is configured, but you still need an open sketch before compile or upload tells you anything useful.',
      facts,
      warnings,
      nextStep: 'Open an existing sketch or create a new `.ino` file, then verify before uploading.',
    };
  }

  if (!hasPort) {
    return {
      title: 'Arduino readiness',
      status: 'caution',
      label: 'Compile only',
      summary: 'ProtoPulse can help you verify firmware, but upload is still blocked until the selected profile has the correct device port.',
      facts,
      warnings,
      nextStep: 'Edit the board profile, set the correct serial port, then re-check the profile before uploading.',
    };
  }

  if (devicePreflight?.status === 'port_missing' || devicePreflight?.status === 'board_mismatch') {
    return {
      title: 'Arduino readiness',
      status: 'caution',
      label: devicePreflight.status === 'board_mismatch' ? 'Check board' : 'Check port',
      summary: devicePreflight.blockerReason ?? 'ProtoPulse found a mismatch between the selected upload target and the connected hardware.',
      facts,
      warnings,
      nextStep: 'Reconnect the intended board, refresh the detected device list, then make sure the selected profile matches the real port and board before uploading.',
    };
  }

  if (devicePreflight?.status === 'device_unidentified') {
    return {
      title: 'Arduino readiness',
      status: 'caution',
      label: 'Review device',
      summary: 'ProtoPulse found a device on the selected port, but Arduino CLI could not confidently identify the board family.',
      facts,
      warnings,
      nextStep: 'Confirm the board profile and port manually, then verify the sketch before uploading to hardware.',
    };
  }

  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
    return {
      title: 'Arduino readiness',
      status: 'ready',
      label: 'Job running',
      summary: 'The firmware toolchain is configured and actively working. Treat the console as the source of truth until the current job finishes.',
      facts,
      warnings,
      nextStep: 'Let the current job finish, review the output, then retry only if the result still needs another pass.',
    };
  }

  return {
    title: 'Arduino readiness',
    status: 'ready',
    label: 'Board ready',
    summary: 'CLI, workspace, board profile, serial port, and sketch context are all in place for verify/upload work.',
    facts,
    warnings,
    nextStep: 'Verify the sketch first, then confirm the selected board and port one more time before uploading to hardware.',
  };
}

export function buildSerialTrustReceipt({
  baudRate,
  bytesReceived,
  bytesSent,
  connectionState,
  devicePreflight,
  error,
  isSupported,
  portInfo,
  selectedBoardProfile,
  showTroubleshootHint,
}: SerialTrustInput): TrustReceipt {
  const facts = [
    { label: 'Device filter', value: selectedBoardProfile?.trim() || 'Any device' },
    { label: 'Port', value: formatPortInfo(portInfo) },
    { label: 'Detected device', value: devicePreflight?.detectedDeviceLabel ?? 'Not checked' },
    { label: 'Arduino profile', value: devicePreflight?.arduinoProfileLabel ?? 'No Arduino profile' },
    { label: 'Board safety', value: devicePreflight?.boardSafetyLabel ?? 'Not checked' },
    { label: 'Baud', value: baudRate.toLocaleString() },
    { label: 'Traffic', value: `${bytesReceived.toLocaleString()} RX / ${bytesSent.toLocaleString()} TX` },
  ];

  const warnings: string[] = [];
  if (!selectedBoardProfile?.trim()) {
    warnings.push('No board filter is selected, so the connect flow can attach to the wrong serial device.');
  }
  if (connectionState === 'disconnected') {
    warnings.push('No serial device is connected yet, so the monitor is still in setup mode.');
  }
  if (connectionState === 'connected' && bytesReceived === 0) {
    warnings.push('The device is connected, but no RX data has arrived yet.');
  }
  if (showTroubleshootHint) {
    warnings.push('ProtoPulse has not seen incoming data for 10 seconds, so the board may need reset, a different baud rate, or a different port.');
  }
  if (devicePreflight?.warnings) {
    warnings.push(...devicePreflight.warnings);
  }
  if (error) {
    warnings.push(`Latest serial error: ${error}`);
  }

  if (!isSupported) {
    return {
      title: 'Serial device preflight',
      status: 'setup_required',
      label: 'Unsupported',
      summary: 'The current browser does not expose Web Serial, so this panel cannot talk to real hardware yet.',
      facts,
      warnings,
      nextStep: 'Use a supported browser/runtime with Web Serial access before relying on this monitor.',
    };
  }

  if (connectionState === 'connecting') {
    return {
      title: 'Serial device preflight',
      status: 'setup_required',
      label: 'Connecting',
      summary: 'ProtoPulse is negotiating a serial session. Wait for the device identity and live stream before trusting the monitor.',
      facts,
      warnings,
      nextStep: 'Let the connection finish, then confirm the detected device and baud rate before sending commands.',
    };
  }

  if (connectionState === 'disconnected') {
    return {
      title: 'Serial device preflight',
      status: 'setup_required',
      label: 'No device',
      summary: 'The serial monitor is configured, but no live hardware session exists yet.',
      facts,
      warnings,
      nextStep: 'Choose a board filter if helpful, then connect to the target device before trusting monitor output.',
    };
  }

  if (connectionState === 'error') {
    return {
      title: 'Serial device preflight',
      status: 'caution',
      label: 'Connection error',
      summary: 'The monitor has enough context to diagnose the session, but the current link is degraded and should not be treated as trustworthy telemetry.',
      facts,
      warnings,
      nextStep: 'Reconnect the device, confirm the baud rate and port, then wait for clean RX data before sending commands.',
    };
  }

  if (devicePreflight?.status === 'profile_mismatch' || devicePreflight?.status === 'filter_mismatch') {
    return {
      title: 'Serial device preflight',
      status: 'caution',
      label: 'Check board',
      summary: devicePreflight.blockerReason ?? 'ProtoPulse found a mismatch between the connected serial device and the expected board context.',
      facts,
      warnings,
      nextStep: 'Align the serial device, the board filter, and the active Arduino profile before trusting monitor traffic or sending commands.',
    };
  }

  if (devicePreflight?.status === 'device_unidentified') {
    return {
      title: 'Serial device preflight',
      status: 'caution',
      label: 'Review device',
      summary: 'A serial device is connected, but ProtoPulse cannot confidently identify its board family yet.',
      facts,
      warnings,
      nextStep: 'Verify the board manually, then match the board filter or Arduino profile before relying on the session.',
    };
  }

  if (bytesReceived === 0 || showTroubleshootHint) {
    return {
      title: 'Serial device preflight',
      status: 'caution',
      label: 'Waiting for RX',
      summary: 'ProtoPulse has a live serial link, but the device is not producing trustworthy traffic yet.',
      facts,
      warnings,
      nextStep: 'Reset the board, confirm the baud rate, and verify that the selected port matches the intended device.',
    };
  }

  return {
    title: 'Serial device preflight',
    status: 'ready',
    label: 'Live session',
    summary: 'Device identity, baud rate, and live traffic are all present, so this monitor is ready for real debugging work.',
    facts,
    warnings,
    nextStep: 'Watch for clean RX output, then send commands or save a recording once the session looks stable.',
  };
}

export function buildDesignAgentTrustReceipt({
  apiKeyValid,
  connectionStatus,
  hasApiKey,
  hasSession,
  isReconnecting,
  isRunning,
  previewAiChanges,
  reviewPendingCount,
  reviewThreshold,
  safetyModeEnabled,
  strongestSafetyClassification,
}: DesignAgentTrustInput): TrustReceipt {
  const applyMode = previewAiChanges
    ? 'Preview before apply'
    : safetyModeEnabled
      ? 'Direct apply with safety checks'
      : 'Direct apply';

  const facts = [
    {
      label: 'Session',
      value: hasSession ? (connectionStatus === 'connected' ? 'Ready' : connectionStatus) : 'Missing',
    },
    {
      label: 'API key',
      value: hasApiKey ? (apiKeyValid ? 'Configured' : 'Needs attention') : 'Missing',
    },
    { label: 'Apply mode', value: applyMode },
    { label: 'Review queue', value: reviewPendingCount > 0 ? `${reviewPendingCount} pending` : 'Clear' },
    { label: 'Low-confidence threshold', value: `${reviewThreshold}%` },
    { label: 'Highest action risk', value: strongestSafetyClassification },
  ];

  const warnings: string[] = [];
  if (!hasSession) {
    warnings.push('The design agent needs a live ProtoPulse session before it can safely plan or change project state.');
  }
  if (!hasApiKey) {
    warnings.push('No AI provider key is configured for this project, so the design agent cannot run yet.');
  } else if (!apiKeyValid) {
    warnings.push('The configured API key does not look valid for the current provider settings.');
  }
  if (connectionStatus === 'offline') {
    warnings.push('ProtoPulse is offline, so streaming agent runs will fail until the connection recovers.');
  }
  if (connectionStatus === 'reconnecting' || isReconnecting) {
    warnings.push('The connection is unstable, so streamed steps may pause or need to recover before the run is trustworthy.');
  }
  if (!previewAiChanges && !safetyModeEnabled) {
    warnings.push('Agent actions can move straight into project changes without preview or safety confirmation.');
  } else if (!previewAiChanges) {
    warnings.push('Low-risk actions may still apply directly when they do not trigger the safety confirmation flow.');
  }
  if (reviewPendingCount > 0) {
    warnings.push('Low-confidence AI actions are already waiting in the review queue and should be resolved before trusting more automation.');
  }
  if (isRunning) {
    warnings.push('A design-agent run is active right now, so the step log is still the live source of truth.');
  }

  if (!hasSession) {
    return {
      title: 'Design agent trust receipt',
      status: 'setup_required',
      label: 'Session required',
      summary: 'ProtoPulse cannot trust or apply design-agent work until the current project session is active.',
      facts,
      warnings,
      nextStep: 'Reconnect or sign in again, then reopen the project before running the design agent.',
    };
  }

  if (connectionStatus === 'offline') {
    return {
      title: 'Design agent trust receipt',
      status: 'setup_required',
      label: 'Offline',
      summary: 'The design agent is blocked because ProtoPulse is currently offline.',
      facts,
      warnings,
      nextStep: 'Restore connectivity first, then rerun the agent when the session returns to connected.',
    };
  }

  if (!hasApiKey) {
    return {
      title: 'Design agent trust receipt',
      status: 'setup_required',
      label: 'API key required',
      summary: 'The design agent needs a configured provider key before it can plan or modify anything.',
      facts,
      warnings,
      nextStep: 'Configure a valid AI provider key, then come back and run the agent.',
    };
  }

  if (!apiKeyValid) {
    return {
      title: 'Design agent trust receipt',
      status: 'setup_required',
      label: 'Check key',
      summary: 'The stored AI key does not look usable for the current provider, so agent runs should be treated as blocked.',
      facts,
      warnings,
      nextStep: 'Fix the provider key or switch providers before trusting the design agent.',
    };
  }

  if (connectionStatus === 'reconnecting' || isReconnecting) {
    return {
      title: 'Design agent trust receipt',
      status: 'caution',
      label: 'Reconnecting',
      summary: 'The design agent is configured, but the stream transport is unstable right now and may require recovery.',
      facts,
      warnings,
      nextStep: 'Wait for the connection to settle before starting a new run or judging the current step log.',
    };
  }

  if (!previewAiChanges && !safetyModeEnabled) {
    return {
      title: 'Design agent trust receipt',
      status: 'caution',
      label: 'Direct apply',
      summary: 'The design agent is able to run, but its change path is currently too aggressive for trust-first work.',
      facts,
      warnings,
      nextStep: 'Turn preview back on or re-enable AI safety mode before letting the agent touch project state.',
    };
  }

  if (reviewPendingCount > 0) {
    return {
      title: 'Design agent trust receipt',
      status: 'caution',
      label: 'Review queue active',
      summary: 'The agent is configured, but there are already low-confidence AI items waiting for human review.',
      facts,
      warnings,
      nextStep: 'Resolve the pending review queue before treating new agent output as cleanly trusted.',
    };
  }

  return {
    title: 'Design agent trust receipt',
    status: 'ready',
    label: previewAiChanges ? 'Review-first' : 'Safety-guarded',
    summary: previewAiChanges
      ? 'The design agent is configured to stream a plan while keeping project changes in a review-first posture.'
      : 'The design agent is configured with safety confirmations, but some low-risk actions may still apply directly.',
    facts,
    warnings,
    nextStep: previewAiChanges
      ? 'Run the agent, review the proposed changes, and only then let them touch project state.'
      : 'Run the agent, then read the safety prompts carefully before approving any change-heavy action.',
  };
}

export function buildChatActionTrustReceipt({
  actionCount,
  confidenceScore,
  previewAiChanges,
  reviewPendingCount,
  reviewThreshold,
  safetyModeEnabled,
  sourceCount,
  strongestSafetyClassification,
}: ChatActionTrustInput): TrustReceipt {
  const applyMode = previewAiChanges
    ? 'Preview before apply'
    : safetyModeEnabled
      ? 'Direct apply with safety checks'
      : 'Direct apply';

  const facts = [
    { label: 'Proposed actions', value: String(actionCount) },
    { label: 'Source trail', value: sourceCount > 0 ? `${sourceCount} attached` : 'None' },
    { label: 'Confidence', value: confidenceScore === undefined ? 'Unavailable' : `${Math.round(confidenceScore)}%` },
    { label: 'Apply mode', value: applyMode },
    { label: 'Review queue', value: reviewPendingCount > 0 ? `${reviewPendingCount} pending` : 'Clear' },
    { label: 'Highest action risk', value: strongestSafetyClassification },
  ];

  const warnings: string[] = [];
  if (sourceCount === 0) {
    warnings.push('No grounded project sources were attached to this proposal, so you should treat it as an unverified draft.');
  }
  if (confidenceScore === undefined || Number.isNaN(confidenceScore)) {
    warnings.push('The AI did not return a confidence score for this proposal.');
  } else if (confidenceScore < reviewThreshold) {
    warnings.push('This proposal is below the current review threshold and should be treated as low-confidence until you verify it manually.');
  }
  if (strongestSafetyClassification === 'destructive') {
    warnings.push('These actions include destructive changes that can remove or overwrite project state.');
  } else if (strongestSafetyClassification === 'caution') {
    warnings.push('These actions can make meaningful design changes and deserve a careful review before you apply them.');
  }
  if (!previewAiChanges && !safetyModeEnabled) {
    warnings.push('Accepted actions will apply immediately without preview mode or safety confirmations.');
  } else if (!previewAiChanges) {
    warnings.push('Accepted actions may still apply directly once this review step is approved.');
  }
  if (reviewPendingCount > 0) {
    warnings.push('Other low-confidence AI items are already waiting in the review queue.');
  }

  if (actionCount === 0) {
    return {
      title: 'AI action review receipt',
      status: 'setup_required',
      label: 'No actions',
      summary: 'There are no AI-generated project changes waiting for review right now.',
      facts,
      warnings,
      nextStep: 'Ask the AI for a concrete change proposal if you want it to modify the project.',
    };
  }

  if (sourceCount === 0) {
    return {
      title: 'AI action review receipt',
      status: 'caution',
      label: 'Source-light',
      summary: 'The AI proposed project changes, but it did not attach a grounded source trail, so this review step is not yet strongly trustworthy.',
      facts,
      warnings,
      nextStep: 'Ask the AI to explain its rationale or cite the project evidence it used before you apply these changes.',
    };
  }

  if (confidenceScore === undefined || Number.isNaN(confidenceScore)) {
    return {
      title: 'AI action review receipt',
      status: 'caution',
      label: 'Confidence missing',
      summary: 'The proposal has some project grounding, but the AI did not attach a confidence score, so this should still be treated as a manual-review checkpoint.',
      facts,
      warnings,
      nextStep: 'Review the action list line by line and only apply the changes you can independently verify.',
    };
  }

  if (confidenceScore < reviewThreshold) {
    return {
      title: 'AI action review receipt',
      status: 'caution',
      label: 'Low confidence',
      summary: 'These proposed changes are below the current review threshold, so they should be treated as low-confidence suggestions rather than trusted edits.',
      facts,
      warnings,
      nextStep: 'Review the proposal carefully, ask for more evidence if needed, and only apply the parts you can verify.',
    };
  }

  if (strongestSafetyClassification === 'destructive') {
    return {
      title: 'AI action review receipt',
      status: 'caution',
      label: previewAiChanges ? 'Destructive review' : 'High-risk apply',
      summary: 'The proposal is grounded and above the confidence threshold, but it still includes destructive actions that deserve extra care before they touch project state.',
      facts,
      warnings,
      nextStep: 'Snapshot or double-check the affected design areas, then approve only if the destructive changes are exactly what you intend.',
    };
  }

  if (!previewAiChanges && !safetyModeEnabled) {
    return {
      title: 'AI action review receipt',
      status: 'caution',
      label: 'Direct apply',
      summary: 'The proposal has evidence attached, but the current apply path is still too aggressive for a trust-first workflow.',
      facts,
      warnings,
      nextStep: 'Turn preview mode or safety confirmations back on before relying on this apply flow for important design changes.',
    };
  }

  return {
    title: 'AI action review receipt',
    status: 'ready',
    label: previewAiChanges ? 'Review-first' : 'Safety-guarded',
    summary: previewAiChanges
      ? 'This proposal includes grounded evidence and is already staged for human review before anything is applied.'
      : 'This proposal includes grounded evidence and still has safety checks available before the changes land.',
    facts,
    warnings,
    nextStep: 'Review the proposed actions, then apply them if they match your intent and the cited evidence looks sound.',
  };
}
