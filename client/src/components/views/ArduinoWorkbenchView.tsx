import { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useArduino } from '@/lib/contexts/arduino-context';
import { buildArduinoTrustReceipt } from '@/lib/trust-receipts';
import { cn } from '@/lib/utils';
import { FileJson, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TrustReceiptCard from '@/components/ui/TrustReceiptCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { downloadBlob } from '@/lib/csv';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';
import { parseCompileOutput } from '@/lib/arduino/cli-error-parser';
import CodeEditor from '@/components/views/circuit-code/CodeEditor';
import { formatArduinoCode } from '@/lib/arduino/code-formatter';
import {
  assessArduinoUploadTarget,
  normalizeDetectedArduinoBoards,
  type DetectedArduinoDevice,
} from '@/lib/arduino/device-preflight';
import { translateCompileOutput } from '@/lib/arduino/error-translator';
import { linkErrorsToKnowledge } from '@/lib/arduino/error-knowledge-linker';
import type { LinkedError } from '@/lib/arduino/error-knowledge-linker';
import { parseFlashOutput, diagnoseFlashError, createInitialProgress } from '@/lib/arduino/flash-diagnostics';
import type { FlashProgress, FlashDiagnostic } from '@/lib/arduino/flash-diagnostics';
import { useCircuitDesigns, useCircuitInstances, useCircuitNets } from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { generatePinConstants } from '@shared/arduino-pin-generator';
import type { NetInfo, InstanceInfo, PinConstant } from '@shared/arduino-pin-generator';
import { detectPinConflicts } from '@/lib/arduino/pin-conflict-checker';
import { createArduinoAutocompletion } from '@/lib/arduino/autocomplete';
import { consumePendingStarterCircuitLaunch } from '@/lib/starter-circuit-launch';
import type { BottomTab } from './arduino/types';
import ArduinoToolbar from './arduino/ArduinoToolbar';
import ArduinoFileExplorer from './arduino/ArduinoFileExplorer';
import ArduinoBottomPanel from './arduino/ArduinoBottomPanel';

const ProfileSettingsDialog = lazy(() => import('@/components/arduino/ProfileSettingsDialog'));

function toStarterSketchFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${base || 'Starter_Circuit'}.ino`;
}

const RADIAL_ARDUINO_SNIPPET = `// Radial quick helper
void radialLog(const char* label) {
  Serial.print("[radial] ");
  Serial.println(label);
}
`;

function insertRadialArduinoSnippet(source: string): string {
  if (source.includes('radialLog(')) {
    return source;
  }

  return `${source.trimEnd()}\n\n${RADIAL_ARDUINO_SNIPPET}`;
}

function getFileDownloadName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? 'sketch.ino';
}

export default function ArduinoWorkbenchView() {
  const _projectId = useProjectId();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const {
    health,
    workspace,
    files = [],
    jobs = [],
    profiles = [],
    installedLibraries = [],
    installedCores = [],
    isHealthLoading,
    isFilesLoading,
    isLibrariesLoading,
    isCoresLoading,
    readFile,
    writeFile,
    createFile,
    compileJob,
    uploadJob,
    cancelJob,
    downloadArtifact,
    updateProfile,
    searchLibraries,
    installLibrary,
    uninstallLibrary,
    listBoards,
    searchCores,
    installCore,
    uninstallCore,
    refreshLibraries,
    refreshCores,
  } = useArduino();

  const { toast } = useToast();

  // Editor state
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Examples browser state
  const [showExamples, setShowExamples] = useState(false);
  const [showExampleLibrary, setShowExampleLibrary] = useState(false);

  // Console state
  const [autoScroll, setAutoScroll] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  // Bottom panel tab
  const [bottomTab, setBottomTab] = useState<BottomTab>('console');

  // New-file dialog state
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // BL-0602: Live error highlighting state
  const [syntaxErrors, setSyntaxErrors] = useState<Array<{ message: string; line?: number }>>([]);

  // Flash progress state
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null);
  const [flashDiagnostic, setFlashDiagnostic] = useState<FlashDiagnostic | null>(null);
  const flashProgressRef = useRef<FlashProgress | null>(null);
  const [detectedBoards, setDetectedBoards] = useState<DetectedArduinoDevice[] | null>(null);
  const [isCheckingUploadTarget, setIsCheckingUploadTarget] = useState(false);

  // Selected profile id
  const defaultProfile = useMemo(() => profiles.find((p) => p.isDefault) ?? profiles[0], [profiles]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  useEffect(() => {
    if (defaultProfile && !selectedProfileId) {
      setSelectedProfileId(String(defaultProfile.id));
    }
  }, [defaultProfile, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => String(p.id) === selectedProfileId),
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    let cancelled = false;

    if (health?.status !== 'ok' || !selectedProfile?.port?.trim()) {
      setDetectedBoards(null);
      setIsCheckingUploadTarget(false);
      return;
    }

    setIsCheckingUploadTarget(true);
    void listBoards()
      .then((boards) => {
        if (cancelled) {
          return;
        }
        setDetectedBoards(normalizeDetectedArduinoBoards(boards));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setDetectedBoards([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingUploadTarget(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [health?.status, listBoards, selectedProfile?.fqbn, selectedProfile?.port]);

  const activeFile = useMemo(() => files.find((f) => f.relativePath === activeFilePath), [files, activeFilePath]);

  const activeJob = useMemo(() => jobs.find((j) => j.status === 'running' || j.status === 'pending'), [jobs]);

  const uploadTargetAssessment = useMemo(
    () => assessArduinoUploadTarget({ detectedBoards, isChecking: isCheckingUploadTarget, selectedProfile }),
    [detectedBoards, isCheckingUploadTarget, selectedProfile],
  );

  const lastCompletedCompile = useMemo(
    () => jobs.find((j) => j.status === 'completed' && j.jobType === 'compile'),
    [jobs],
  );

  // --- BL-0142: Schematic Pin Data ---
  const { data: circuits } = useCircuitDesigns(_projectId);
  const activeCircuitId = circuits?.[0]?.id ?? 0;
  const { data: circuitInstances } = useCircuitInstances(activeCircuitId);
  const { data: circuitNets } = useCircuitNets(activeCircuitId);
  const { data: componentParts } = useComponentParts(_projectId);

  const schematicPinData = useMemo(() => {
    if (!circuitInstances || !circuitNets || !componentParts) {
      return {
        mappedInstances: [] as InstanceInfo[],
        mappedNets: [] as NetInfo[],
        schematicPinConstants: [] as PinConstant[],
      };
    }

    const mappedInstances: InstanceInfo[] = circuitInstances.map((inst) => {
      const part = componentParts.find((p) => p.id === inst.partId);
      const connectors = (part?.connectors ?? []) as Array<{ name?: string; padType?: string; padWidth?: number }>;

      const mappedPins = connectors.map((c) => ({
        pinName: c.name || 'Pin',
        netId: 'mock-net',
        physicalPin: c.padType === 'tht' ? c.padWidth : undefined,
      }));

      const meta = (part?.meta ?? {}) as Record<string, unknown>;
      return {
        id: String(inst.id),
        componentType: typeof meta.title === 'string' ? meta.title : 'Unknown',
        label: inst.referenceDesignator,
        pins: mappedPins,
      };
    });

    const mappedNets: NetInfo[] = circuitNets.map((n) => ({
      id: String(n.id),
      name: n.name,
    }));

    const schematicPinConstants = generatePinConstants(mappedNets, mappedInstances, {
      boardType: selectedProfile?.fqbn.includes('mega')
        ? 'mega'
        : selectedProfile?.fqbn.includes('nano')
          ? 'nano'
          : 'uno',
      includeComments: false,
      groupByCategory: false,
    });

    return { mappedInstances, mappedNets, schematicPinConstants };
  }, [circuitInstances, circuitNets, componentParts, selectedProfile?.fqbn]);

  // ---------------------------------------------------------------------------
  // File loading
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activeFilePath) {
      setCode('');
      setIsDirty(false);
      return;
    }
    readFile(activeFilePath)
      .then((content) => {
        setCode(content);
        setIsDirty(false);
      })
      .catch((e: Error) => {
        toast({ variant: 'destructive', title: 'Error reading file', description: e.message });
      });
  }, [activeFilePath, readFile, toast]);

  useEffect(() => {
    const pendingStarter = consumePendingStarterCircuitLaunch();
    if (!pendingStarter) {
      return;
    }

    const filename = toStarterSketchFilename(pendingStarter.name);
    let cancelled = false;

    void createFile(filename, pendingStarter.arduinoCode)
      .then(() => {
        if (cancelled) {
          return;
        }

        setActiveFilePath(filename);
        toast({
          title: 'Starter sketch loaded',
          description: `${filename} is ready in the Arduino workbench.`,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        toast({
          variant: 'destructive',
          title: 'Failed to open starter sketch',
          description: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [createFile, toast]);

  // --- BL-0602: Live Syntax Check (Debounced) ---
  useEffect(() => {
    if (!workspace || !selectedProfile || !activeFile) {
      setSyntaxErrors([]);
      return;
    }

    if (!code.trim()) {
      setSyntaxErrors([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest('POST', `/api/projects/${_projectId}/arduino/check-syntax`, {
          fqbn: selectedProfile.fqbn,
          sketchPath: workspace.activeSketchPath ?? '.',
          filename: activeFile.relativePath,
          sourceCode: code,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.stderr) {
            const parsed = parseCompileOutput(data.stderr);
            const fileErrors = parsed.diagnostics
              .filter((d) => d.file.endsWith(activeFile.relativePath) || d.file === activeFile.relativePath)
              .map((d) => ({
                line: d.line,
                message: `${d.severity}: ${d.message}${d.hint ? `\nHint: ${d.hint}` : ''}`,
              }));

            const conflicts = detectPinConflicts(code, schematicPinData.schematicPinConstants);
            for (const conflict of conflicts) {
              fileErrors.push({
                line: conflict.line,
                message: `warning: ${conflict.message}`,
              });
            }

            setSyntaxErrors(fileErrors);
          } else {
            const fileErrors: Array<{ message: string; line?: number }> = [];
            const conflicts = detectPinConflicts(code, schematicPinData.schematicPinConstants);
            for (const conflict of conflicts) {
              fileErrors.push({
                line: conflict.line,
                message: `warning: ${conflict.message}`,
              });
            }
            setSyntaxErrors(fileErrors);
          }
        }
      } catch {
        // Ignore network errors for background checks
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [code, workspace, selectedProfile, activeFile, _projectId, schematicPinData.schematicPinConstants]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeFilePath) {
      return;
    }
    setIsSaving(true);
    try {
      await writeFile(activeFilePath, code);
      setIsDirty(false);
      toast({ title: 'File saved' });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Save failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsSaving(false);
    }
  }, [activeFilePath, code, writeFile, toast]);

  const handleCompile = useCallback(async () => {
    if (!workspace || !selectedProfile) {
      toast({ variant: 'destructive', title: 'No Build Profile', description: 'Select a build profile first.' });
      return;
    }
    if (isDirty) {
      await handleSave();
    }
    try {
      await compileJob({ fqbn: selectedProfile.fqbn, sketchPath: workspace.activeSketchPath ?? '.' });
      toast({ title: 'Compilation started' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Compile failed',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [workspace, selectedProfile, isDirty, handleSave, compileJob, toast]);

  const handleUpload = useCallback(async () => {
    if (!workspace || !selectedProfile) {
      toast({ variant: 'destructive', title: 'No Build Profile', description: 'Select a build profile first.' });
      return;
    }
    if (!selectedProfile.port) {
      toast({ variant: 'destructive', title: 'No Port', description: 'Edit the profile and set a serial port.' });
      return;
    }
    if (isCheckingUploadTarget) {
      toast({
        title: 'Checking board identity',
        description: 'Wait for ProtoPulse to confirm the connected device before uploading.',
      });
      return;
    }
    if (uploadTargetAssessment.shouldBlockUpload) {
      setProfileDialogOpen(true);
      toast({
        variant: 'destructive',
        title: 'Upload blocked',
        description:
          uploadTargetAssessment.blockerReason ??
          'ProtoPulse could not verify that the selected board and port match the connected hardware.',
      });
      return;
    }
    if (isDirty) {
      await handleSave();
    }
    try {
      await uploadJob({
        fqbn: selectedProfile.fqbn,
        port: selectedProfile.port,
        sketchPath: workspace.activeSketchPath ?? '.',
      });
      toast({ title: 'Upload started' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [
    workspace,
    selectedProfile,
    isCheckingUploadTarget,
    uploadTargetAssessment,
    isDirty,
    handleSave,
    uploadJob,
    toast,
  ]);

  const handleCancelJob = useCallback(async () => {
    if (!activeJob) {
      return;
    }
    try {
      await cancelJob(activeJob.id);
      toast({ title: 'Job cancelled' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Cancel failed',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [activeJob, cancelJob, toast]);

  const handleDownloadArtifact = useCallback(
    async (jobId: number) => {
      try {
        await downloadArtifact(jobId);
        toast({ title: 'Download started' });
      } catch (e: unknown) {
        toast({
          variant: 'destructive',
          title: 'Download failed',
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [downloadArtifact, toast],
  );

  const handleInsertRadialSnippet = useCallback(() => {
    if (!activeFilePath) {
      setNewFileName('radial_helpers.ino');
      setNewFileDialogOpen(true);
      toast({ title: 'Choose a sketch file', description: 'Create or select a file, then insert the radial helper.' });
      return;
    }

    const nextCode = insertRadialArduinoSnippet(code);
    setCode(nextCode);
    setIsDirty(true);
    toast({
      title: 'Firmware snippet inserted',
      description: 'Serial radialLog helper was added to the active sketch.',
    });
  }, [activeFilePath, code, toast]);

  const handleExportFirmwareSource = useCallback(() => {
    if (lastCompletedCompile) {
      void handleDownloadArtifact(lastCompletedCompile.id);
      return;
    }

    if (!activeFilePath || !code.trim()) {
      toast({
        title: 'Nothing to export',
        description: 'Select a sketch file or compile firmware first.',
        variant: 'destructive',
      });
      return;
    }

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    void downloadBlob(blob, getFileDownloadName(activeFilePath));
    toast({ title: 'Firmware source exported', description: `${getFileDownloadName(activeFilePath)} was downloaded.` });
  }, [activeFilePath, code, handleDownloadArtifact, lastCompletedCompile, toast]);

  const handleProfileChange = useCallback(
    async (id: string) => {
      setSelectedProfileId(id);
      const prev = profiles.find((p) => p.isDefault);
      if (prev && String(prev.id) !== id) {
        try {
          await updateProfile(prev.id, { isDefault: false });
          await updateProfile(Number(id), { isDefault: true });
        } catch {
          // non-critical -- local state already updated
        }
      }
    },
    [profiles, updateProfile],
  );

  const handleOpenNewFileDialog = useCallback(() => {
    setNewFileName('');
    setNewFileDialogOpen(true);
  }, []);

  const handleCreateFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name) {
      return;
    }
    setNewFileDialogOpen(false);
    try {
      await createFile(name, '// New file\n');
      setActiveFilePath(name);
      toast({ title: 'File created', description: name });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Creation failed',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [newFileName, createFile, toast]);

  const handleLoadExample = useCallback(
    async (exCode: string, title: string) => {
      const filename = `${title.replace(/\s+/g, '_')}.ino`;
      try {
        await createFile(filename, exCode);
        setActiveFilePath(filename);
        setShowExamples(false);
        setShowExampleLibrary(false);
        toast({ title: 'Example loaded', description: filename });
      } catch (e: unknown) {
        toast({
          variant: 'destructive',
          title: 'Failed to load example',
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [createFile, toast],
  );

  const handleClearConsole = useCallback(() => setConsoleLogs([]), []);

  const handleFormat = useCallback(() => {
    if (!activeFilePath || !code) {
      return;
    }
    const before = code.split('\n').length;
    const formatted = formatArduinoCode(code);
    if (formatted === code) {
      toast({ title: 'Already formatted' });
      return;
    }
    setCode(formatted);
    setIsDirty(true);
    const after = formatted.split('\n').length;
    const delta = after - before;
    const desc = delta === 0 ? 'Reformatted' : delta > 0 ? `+${delta} lines` : `${delta} lines`;
    toast({ title: 'Code formatted', description: desc });
  }, [activeFilePath, code, toast]);

  const handleAiFirmwareReview = useCallback(
    (detail: RadialCommandEventDetail) => {
      const delivery = getRadialAiPromptDelivery(detail);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);
      const codePreview = code.split('\n').slice(0, 40);
      const sections: RadialAiPromptSection[] = [
        {
          title: 'Arduino workbench state',
          lines: [
            `Active file: ${activeFilePath ?? 'none'}`,
            `Workspace sketch: ${workspace?.activeSketchPath ?? 'not set'}`,
            `Health: ${health?.status ?? 'unknown'}`,
            `Active job: ${activeJob ? `${activeJob.jobType} ${activeJob.status}` : 'none'}`,
            `Profiles: ${String(profiles.length)}`,
          ],
        },
        {
          title: 'Selected profile',
          lines: selectedProfile
            ? [
                `Name: ${selectedProfile.name}`,
                `FQBN: ${selectedProfile.fqbn}`,
                `Port: ${selectedProfile.port || 'not set'}`,
                `Upload preflight: ${
                  uploadTargetAssessment.shouldBlockUpload
                    ? (uploadTargetAssessment.blockerReason ?? 'blocked')
                    : uploadTargetAssessment.portSafetyLabel
                }`,
              ]
            : ['No build profile is selected.'],
        },
        {
          title: 'Schematic pin context',
          lines: [
            `Mapped instances: ${String(schematicPinData.mappedInstances.length)}`,
            `Mapped nets: ${String(schematicPinData.mappedNets.length)}`,
            `Generated pin constants: ${String(schematicPinData.schematicPinConstants.length)}`,
          ],
        },
        {
          title: 'Code preview',
          lines: codePreview.length > 0 ? codePreview : ['No source code is loaded.'],
        },
      ];

      runRadialAiCommand({
        intent: 'firmware_review',
        intro:
          'Review this Arduino firmware workspace like a cautious embedded bench partner. Focus on compile/upload readiness, board/profile safety, pin mapping, and the next lowest-risk hardware step.',
        summary: `Arduino firmware review: ${activeFilePath ?? 'no active file'}, ${String(profiles.length)} profiles, ${String(schematicPinData.schematicPinConstants.length)} generated pin constants.`,
        historyLabel: `Arduino firmware review: ${activeFilePath ?? 'workspace'}`,
        context: detail.context,
        delivery,
        targetDetails: [
          `Project id: ${String(_projectId)}`,
          `Selected profile: ${selectedProfile?.name ?? 'none'}`,
          `Upload safety: ${
            uploadTargetAssessment.shouldBlockUpload
              ? (uploadTargetAssessment.blockerReason ?? 'blocked')
              : uploadTargetAssessment.portSafetyLabel
          }`,
        ],
        sections,
        finalInstruction:
          'Give Tyler a compact firmware action plan: what is safe to compile now, what blocks upload, what pins or libraries to verify, and the next bench-safe move.',
      });
      toast({
        title: `AI Firmware Review ${deliveryVerb}`,
        description:
          delivery === 'send-now'
            ? 'Sent Arduino firmware review to AI chat.'
            : 'Drafted Arduino firmware review in AI chat.',
      });
    },
    [
      _projectId,
      activeFilePath,
      activeJob,
      code,
      health?.status,
      profiles.length,
      schematicPinData.mappedInstances.length,
      schematicPinData.mappedNets.length,
      schematicPinData.schematicPinConstants.length,
      selectedProfile,
      toast,
      uploadTargetAssessment,
      workspace?.activeSketchPath,
    ],
  );

  // Ctrl+T keyboard shortcut for format
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [handleFormat]);

  const handleRadialCommand = useCallback(
    (detail: RadialCommandEventDetail): boolean => {
      if (detail.source !== 'radial-menu' || detail.context.view !== 'firmware') {
        return false;
      }

      switch (detail.commandId) {
        case 'add_firmware_snippet':
          handleInsertRadialSnippet();
          return true;
        case 'ai_firmware_review':
          handleAiFirmwareReview(detail);
          return true;
        case 'format_firmware':
          handleFormat();
          return true;
        case 'open_firmware_review':
          setBottomTab('pins');
          toast({
            title: 'Firmware pin review',
            description: 'Generated schematic pin constants are open for review.',
          });
          return true;
        case 'compile_firmware':
          void handleCompile();
          return true;
        case 'open_firmware_console':
          setBottomTab('console');
          toast({ title: 'Firmware console', description: 'Compile and upload output is open.' });
          return true;
        case 'firmware_settings':
          setProfileDialogOpen(true);
          toast({ title: 'Firmware settings', description: 'Board profile and port settings are open.' });
          return true;
        case 'export_firmware':
          handleExportFirmwareSource();
          return true;
        default:
          return false;
      }
    },
    [handleAiFirmwareReview, handleCompile, handleExportFirmwareSource, handleFormat, handleInsertRadialSnippet, toast],
  );

  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      if (!detail) {
        return;
      }
      if (handleRadialCommand(detail)) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
  }, [handleRadialCommand]);

  // Translate compile errors from job logs and link to knowledge hub articles
  const translatedErrors: LinkedError[] = useMemo(() => {
    const failedJob = jobs.find((j) => j.status === 'failed' && j.log);
    if (!failedJob?.log) {
      return [];
    }
    return linkErrorsToKnowledge(translateCompileOutput(failedJob.log));
  }, [jobs]);

  // Track flash progress from active upload job log
  useEffect(() => {
    const uploadJob_ = jobs.find((j) => j.jobType === 'upload' && (j.status === 'running' || j.status === 'pending'));

    if (!uploadJob_) {
      const finishedUpload = jobs.find(
        (j) => j.jobType === 'upload' && (j.status === 'completed' || j.status === 'failed'),
      );
      if (finishedUpload && flashProgress) {
        if (finishedUpload.status === 'completed') {
          const doneProgress: FlashProgress = {
            stage: 'done',
            percent: 100,
            bytesWritten: flashProgressRef.current?.totalBytes ?? 0,
            totalBytes: flashProgressRef.current?.totalBytes ?? 0,
            stageLabel: 'Upload complete!',
          };
          setFlashProgress(doneProgress);
          flashProgressRef.current = doneProgress;
          setFlashDiagnostic(null);

          // BL-0518: Offer to open Serial Monitor after successful upload
          if (selectedProfile?.port) {
            toast({
              title: 'Upload successful!',
              description: `Firmware flashed to ${selectedProfile.port}.`,
              action: (
                <ToastAction altText="Open Serial Monitor" onClick={() => setBottomTab('serial')}>
                  Monitor
                </ToastAction>
              ),
            });
          }
        } else if (finishedUpload.status === 'failed') {
          const errorProgress: FlashProgress = {
            stage: 'error',
            percent: flashProgressRef.current?.percent ?? 0,
            bytesWritten: flashProgressRef.current?.bytesWritten ?? 0,
            totalBytes: flashProgressRef.current?.totalBytes ?? 0,
            stageLabel: 'Upload failed',
          };
          setFlashProgress(errorProgress);
          flashProgressRef.current = errorProgress;
          setFlashDiagnostic(diagnoseFlashError(finishedUpload.log ?? ''));
        }
      }
      return;
    }

    if (!flashProgress || flashProgress.stage === 'done' || flashProgress.stage === 'error') {
      const initial = createInitialProgress();
      setFlashProgress(initial);
      flashProgressRef.current = initial;
      setFlashDiagnostic(null);
    }

    if (uploadJob_.log) {
      const lines = uploadJob_.log.split('\n');
      let current = flashProgressRef.current ?? createInitialProgress();
      for (const line of lines) {
        const parsed = parseFlashOutput(line, current);
        if (parsed) {
          current = parsed;
        }
      }
      if (current !== flashProgressRef.current) {
        setFlashProgress(current);
        flashProgressRef.current = current;
      }
    }
  }, [jobs, flashProgress, selectedProfile?.port, toast]);

  const handleFlashRetry = useCallback(() => {
    setFlashProgress(null);
    setFlashDiagnostic(null);
    flashProgressRef.current = null;
    void handleUpload();
  }, [handleUpload]);

  const handleFlashDismiss = useCallback(() => {
    setFlashProgress(null);
    setFlashDiagnostic(null);
    flashProgressRef.current = null;
  }, []);

  const handleInsertPinCode = useCallback((pinCode: string) => {
    setCode((prev) => pinCode + '\n' + prev);
    setIsDirty(true);
  }, []);

  // Derive editor language from file extension
  const editorLanguage = useMemo((): 'cpp' | 'markdown' | 'javascript' => {
    const ext = activeFile?.language ?? '';
    if (ext === 'ino' || ext === 'cpp' || ext === 'c' || ext === 'h' || ext === 'hpp') {
      return 'cpp';
    }
    if (ext === 'md') {
      return 'markdown';
    }
    return 'javascript';
  }, [activeFile]);

  const readinessReceipt = useMemo(
    () =>
      buildArduinoTrustReceipt({
        activeFilePath,
        activeJob,
        devicePreflight: uploadTargetAssessment,
        healthStatus: health?.status,
        selectedProfile,
        workspace,
      }),
    [activeFilePath, activeJob, health?.status, selectedProfile, uploadTargetAssessment, workspace],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background" data-testid="arduino-workbench-view">
      <ArduinoToolbar
        health={health}
        isHealthLoading={isHealthLoading}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onProfileChange={handleProfileChange}
        onEditProfile={() => setProfileDialogOpen(true)}
        selectedProfile={selectedProfile}
        activeFilePath={activeFilePath}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={handleSave}
        onFormat={handleFormat}
        code={code}
        workspace={workspace}
        activeJob={activeJob}
        onCompile={handleCompile}
        onUpload={handleUpload}
        uploadBlockedReason={
          isCheckingUploadTarget
            ? 'Checking the connected board before upload.'
            : uploadTargetAssessment.shouldBlockUpload
              ? uploadTargetAssessment.blockerReason
              : null
        }
        onCancelJob={handleCancelJob}
        lastCompletedCompile={lastCompletedCompile}
        onDownloadArtifact={(jobId) => void handleDownloadArtifact(jobId)}
        flashProgress={flashProgress}
        flashDiagnostic={flashDiagnostic}
        onFlashRetry={handleFlashRetry}
        onFlashDismiss={handleFlashDismiss}
        projectId={_projectId}
      />

      <TrustReceiptCard receipt={readinessReceipt} className="mx-2.5 mt-2.5" data-testid="trust-receipt-arduino" />

      <div className="flex-1 flex overflow-hidden">
        <ArduinoFileExplorer
          files={files}
          isFilesLoading={isFilesLoading}
          activeFilePath={activeFilePath}
          onSelectFile={setActiveFilePath}
          isDirty={isDirty}
          showExamples={showExamples}
          onShowExamples={setShowExamples}
          showExampleLibrary={showExampleLibrary}
          onShowExampleLibrary={setShowExampleLibrary}
          onLoadExample={handleLoadExample}
          onOpenNewFileDialog={handleOpenNewFileDialog}
          onSetBottomTab={setBottomTab}
        />

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
          {activeFilePath ? (
            <>
              {/* Tab bar */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-card/30 px-2 py-0.5">
                <div className="flex items-center gap-px overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-1.5 whitespace-nowrap border-b border-primary bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary">
                    {activeFilePath}
                    {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Unsaved changes" />}
                  </div>
                </div>
                {activeFile && (
                  <span className="px-1.5 text-[9px] tabular-nums text-muted-foreground">
                    {(activeFile.sizeBytes / 1024).toFixed(1)} KB · {editorLanguage.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  value={code}
                  onChange={handleCodeChange}
                  language={editorLanguage}
                  errors={syntaxErrors}
                  className="h-full"
                  customExtensions={[createArduinoAutocompletion(schematicPinData.schematicPinConstants)]}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
              <div className="bg-zinc-800/50 p-6 rounded-full mb-6 ring-1 ring-white/5">
                <FileJson className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">No File Selected</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select a sketch file from the explorer to begin, or click <strong>+</strong> to create a new one.
              </p>
            </div>
          )}

          <ArduinoBottomPanel
            bottomTab={bottomTab}
            onSetBottomTab={setBottomTab}
            jobs={jobs}
            consoleLogs={consoleLogs}
            autoScroll={autoScroll}
            onSetAutoScroll={setAutoScroll}
            onClearConsole={handleClearConsole}
            translatedErrors={translatedErrors}
            onCancelJob={(jobId) => void cancelJob(jobId)}
            onDownloadArtifact={(jobId) => void handleDownloadArtifact(jobId)}
            code={code}
            projectId={_projectId}
            installedLibraries={installedLibraries}
            isLibrariesLoading={isLibrariesLoading}
            searchLibraries={searchLibraries}
            installLibrary={installLibrary}
            uninstallLibrary={uninstallLibrary}
            refreshLibraries={refreshLibraries}
            installedCores={installedCores}
            isCoresLoading={isCoresLoading}
            searchCores={searchCores}
            installCore={installCore}
            uninstallCore={uninstallCore}
            refreshCores={refreshCores}
            mappedNets={schematicPinData.mappedNets}
            mappedInstances={schematicPinData.mappedInstances}
            onInsertPinCode={handleInsertPinCode}
            activeFilePath={activeFilePath}
          />
        </div>
      </div>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Sketch File</DialogTitle>
            <DialogDescription>
              Create a new Arduino sketch file and add it to this project workspace.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. settings.h or helpers.cpp"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateFile();
            }}
            data-testid="input-arduino-new-file-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateFile()}
              disabled={!newFileName.trim()}
              data-testid="button-arduino-confirm-new-file"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Settings Dialog */}
      <Suspense fallback={null}>
        <ProfileSettingsDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          profile={selectedProfile ?? null}
          onSave={async (updates) => {
            if (selectedProfile) {
              await updateProfile(selectedProfile.id, updates as Parameters<typeof updateProfile>[1]);
            }
          }}
        />
      </Suspense>
    </div>
  );
}
