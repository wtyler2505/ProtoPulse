import { Suspense, lazy } from 'react';
import {
  FileCode,
  Cpu,
  Play,
  Upload,
  Save,
  Loader2,
  AlertCircle,
  Download,
  Square,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VaultInfoIcon } from '@/components/ui/vault-info-icon';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { FlashProgress, FlashDiagnostic } from '@/lib/arduino/flash-diagnostics';
import type { ArduinoBuildProfile, ArduinoJob, ArduinoWorkspace } from '@shared/schema';

const FlashProgressBar = lazy(() => import('@/components/arduino/FlashProgressBar'));
const MemoryAnalyzerPanel = lazy(() => import('@/components/arduino/MemoryAnalyzerPanel'));

interface ArduinoToolbarProps {
  health: { status: string; version?: string } | undefined;
  isHealthLoading: boolean;
  profiles: ArduinoBuildProfile[];
  selectedProfileId: string;
  onProfileChange: (id: string) => void;
  onEditProfile: () => void;
  selectedProfile: ArduinoBuildProfile | undefined;
  activeFilePath: string | null;
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onFormat: () => void;
  code: string;
  workspace: ArduinoWorkspace | undefined;
  activeJob: ArduinoJob | undefined;
  onCompile: () => void;
  onUpload: () => void;
  uploadBlockedReason: string | null;
  onCancelJob: () => void;
  lastCompletedCompile: ArduinoJob | undefined;
  onDownloadArtifact: (jobId: number) => void;
  flashProgress: FlashProgress | null;
  flashDiagnostic: FlashDiagnostic | null;
  onFlashRetry: () => void;
  onFlashDismiss: () => void;
  projectId: number;
}

export default function ArduinoToolbar({
  health,
  isHealthLoading,
  profiles,
  selectedProfileId,
  onProfileChange,
  onEditProfile,
  selectedProfile,
  activeFilePath,
  isSaving,
  isDirty,
  onSave,
  onFormat,
  code,
  workspace,
  activeJob,
  onCompile,
  onUpload,
  uploadBlockedReason,
  onCancelJob,
  lastCompletedCompile,
  onDownloadArtifact,
  flashProgress,
  flashDiagnostic,
  onFlashRetry,
  onFlashDismiss,
  projectId,
}: ArduinoToolbarProps) {
  return (
    <>
      {/* Tool Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-1.5 rounded-md">
            <FileCode className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Arduino Workbench</h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Firmware Development</p>
              {isHealthLoading ? (
                <Badge variant="outline" className="h-3.5 px-1.5 text-[8px]"><Loader2 className="w-2 h-2 animate-spin" /></Badge>
              ) : health?.status === 'ok' ? (
                <Badge variant="outline" className="h-3.5 px-1.5 text-[8px] border-emerald-500/20 text-emerald-500 bg-emerald-500/5">CLI v{health.version}</Badge>
              ) : (
                <Badge variant="outline" className="h-3.5 px-1.5 text-[8px] border-destructive/20 text-destructive bg-destructive/5 gap-1">
                  <AlertCircle className="w-2 h-2" />CLI Disconnected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedProfileId} onValueChange={onProfileChange}>
            <SelectTrigger className="h-8 w-44 text-[11px] bg-background/50 border-border/50">
              <Cpu className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Select Profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
              {profiles.length === 0 && (
                <div className="p-2 text-[10px] text-center text-muted-foreground">No profiles configured</div>
              )}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            disabled={!selectedProfile}
            onClick={onEditProfile}
            title="Edit Profile & Port"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground border-border/50"
            onClick={onSave}
            disabled={!activeFilePath || isSaving || !isDirty}
            title="Save (Ctrl+S)"
            data-testid="button-arduino-save"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground border-border/50"
            onClick={onFormat}
            disabled={!activeFilePath || !code}
            title="Format Code (Ctrl+T)"
            data-testid="button-arduino-format"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </Button>

          <div className="inline-flex items-center gap-1">
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
              disabled={!workspace || !!activeJob || !selectedProfile}
              onClick={onCompile}
              data-testid="button-arduino-compile"
            >
              {activeJob?.jobType === 'compile' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Verify</span>
            </Button>
            <VaultInfoIcon
              topic="arduino-build-pipeline-verify-vs-upload-compilation-only"
              testId="arduino-verify-vault-info"
              ariaLabel="About Arduino Verify vs Upload"
              sizeClass="w-3.5 h-3.5"
            />
          </div>

          <Button
            size="sm"
            className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            disabled={!workspace || !!activeJob || !selectedProfile || Boolean(uploadBlockedReason)}
            onClick={onUpload}
            data-testid="button-arduino-upload"
            title={uploadBlockedReason ?? 'Upload firmware to the selected device'}
          >
            {activeJob?.jobType === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Upload</span>
          </Button>

          {/* Cancel button -- visible when a job is running */}
          {activeJob && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={onCancelJob}
              data-testid="button-arduino-cancel-job"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel</span>
            </Button>
          )}

          {/* Download artifact -- visible when last compile succeeded */}
          {lastCompletedCompile && !activeJob && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border/50 text-muted-foreground hover:text-foreground"
              onClick={() => onDownloadArtifact(lastCompletedCompile.id)}
              data-testid="button-arduino-download-binary"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Binary</span>
            </Button>
          )}
        </div>
      </div>

      {/* Flash progress bar -- visible during/after upload */}
      {flashProgress && (
        <Suspense fallback={null}>
          <FlashProgressBar
            progress={flashProgress}
            diagnostic={flashDiagnostic ?? undefined}
            onRetry={onFlashRetry}
            onDismiss={onFlashDismiss}
            className="mx-3 mb-1"
          />
        </Suspense>
      )}

      {/* BL-0616: Memory Breakdown Panel */}
      {lastCompletedCompile && !activeJob && (
        <Suspense fallback={null}>
          <MemoryAnalyzerPanel projectId={projectId} jobId={lastCompletedCompile.id} />
        </Suspense>
      )}
    </>
  );
}
