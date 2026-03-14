import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useArduino } from '@/lib/contexts/arduino-context';
import { cn } from '@/lib/utils';
import {
  FileCode,
  Cpu,
  Library,
  Terminal,
  Play,
  Upload,
  Save,
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileJson,
  FileText,
  History as HistoryIcon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Package,
  Square,
  BookOpen,
  Ban,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import CodeEditor from '@/components/views/circuit-code/CodeEditor';
import ExamplesBrowser from '@/components/views/arduino/ExamplesBrowser';
import { formatArduinoCode } from '@/lib/arduino/code-formatter';
import { translateCompileOutput } from '@/lib/arduino/error-translator';
import type { ErrorTranslation } from '@/lib/arduino/error-translator';

const SerialMonitorPanel = lazy(() => import('@/components/panels/SerialMonitorPanel'));

type BottomTab = 'console' | 'serial' | 'libraries' | 'boards';

export default function ArduinoWorkbenchView() {
  const _projectId = useProjectId();
  const {
    health,
    workspace,
    files,
    jobs,
    profiles,
    installedLibraries,
    installedCores,
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

  // File explorer state
  const [searchQuery, setSearchQuery] = useState('');

  // New-file dialog state (replaces forbidden prompt())
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Examples browser state
  const [showExamples, setShowExamples] = useState(false);

  // Console state
  const [autoScroll, setAutoScroll] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Bottom panel tab
  const [bottomTab, setBottomTab] = useState<BottomTab>('console');

  // Library manager state
  const [libSearchQuery, setLibSearchQuery] = useState('');
  const [libSearchResults, setLibSearchResults] = useState<unknown[]>([]);
  const [libSearching, setLibSearching] = useState(false);
  const [libInstalling, setLibInstalling] = useState<string | null>(null);

  // Board manager state
  const [coreSearchQuery, setCoreSearchQuery] = useState('');
  const [coreSearchResults, setCoreSearchResults] = useState<unknown[]>([]);
  const [coreSearching, setCoreSearching] = useState(false);
  const [coreInstalling, setCoreInstalling] = useState<string | null>(null);

  // Selected profile id (local UI state — not necessarily the isDefault flag)
  const defaultProfile = useMemo(() => profiles.find(p => p.isDefault) ?? profiles[0], [profiles]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  useEffect(() => {
    if (defaultProfile && !selectedProfileId) {
      setSelectedProfileId(String(defaultProfile.id));
    }
  }, [defaultProfile, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find(p => String(p.id) === selectedProfileId),
    [profiles, selectedProfileId],
  );

  const activeFile = useMemo(
    () => files.find(f => f.relativePath === activeFilePath),
    [files, activeFilePath],
  );

  const activeJob = useMemo(
    () => jobs.find(j => j.status === 'running' || j.status === 'pending'),
    [jobs],
  );

  const lastCompletedCompile = useMemo(
    () => jobs.find(j => j.status === 'completed' && j.jobType === 'compile'),
    [jobs],
  );

  // ---------------------------------------------------------------------------
  // File loading — `readFile` is a stable callback so safe in deps
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

  // Auto-scroll console
  useEffect(() => {
    if (autoScroll) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobs, autoScroll]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeFilePath) return;
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
    if (isDirty) await handleSave();
    try {
      await compileJob({ fqbn: selectedProfile.fqbn, sketchPath: workspace.activeSketchPath ?? '.' });
      toast({ title: 'Compilation started' });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Compile failed', description: e instanceof Error ? e.message : String(e) });
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
    if (isDirty) await handleSave();
    try {
      await uploadJob({ fqbn: selectedProfile.fqbn, port: selectedProfile.port, sketchPath: workspace.activeSketchPath ?? '.' });
      toast({ title: 'Upload started' });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e instanceof Error ? e.message : String(e) });
    }
  }, [workspace, selectedProfile, isDirty, handleSave, uploadJob, toast]);

  const handleCancelJob = useCallback(async () => {
    if (!activeJob) return;
    try {
      await cancelJob(activeJob.id);
      toast({ title: 'Job cancelled' });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Cancel failed', description: e instanceof Error ? e.message : String(e) });
    }
  }, [activeJob, cancelJob, toast]);

  const handleDownloadArtifact = useCallback(async (jobId: number) => {
    try {
      await downloadArtifact(jobId);
      toast({ title: 'Download started' });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Download failed', description: e instanceof Error ? e.message : String(e) });
    }
  }, [downloadArtifact, toast]);

  const handleProfileChange = useCallback(async (id: string) => {
    setSelectedProfileId(id);
    // Persist isDefault so the next session remembers the selection
    const prev = profiles.find(p => p.isDefault);
    if (prev && String(prev.id) !== id) {
      try {
        await updateProfile(prev.id, { isDefault: false });
        await updateProfile(Number(id), { isDefault: true });
      } catch {
        // non-critical — local state already updated
      }
    }
  }, [profiles, updateProfile]);

  const handleOpenNewFileDialog = useCallback(() => {
    setNewFileName('');
    setNewFileDialogOpen(true);
  }, []);

  const handleCreateFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name) return;
    setNewFileDialogOpen(false);
    try {
      await createFile(name, '// New file\n');
      setActiveFilePath(name);
      toast({ title: 'File created', description: name });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Creation failed', description: e instanceof Error ? e.message : String(e) });
    }
  }, [newFileName, createFile, toast]);

  const handleLoadExample = useCallback(async (exCode: string, title: string) => {
    const filename = `${title.replace(/\s+/g, '_')}.ino`;
    try {
      await createFile(filename, exCode);
      setActiveFilePath(filename);
      setShowExamples(false);
      toast({ title: 'Example loaded', description: filename });
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Failed to load example', description: e instanceof Error ? e.message : String(e) });
    }
  }, [createFile, toast]);

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

  // Translate compile errors from job logs
  const translatedErrors: ErrorTranslation[] = useMemo(() => {
    const failedJob = jobs.find(j => j.status === 'failed' && j.log);
    if (!failedJob?.log) {
      return [];
    }
    return translateCompileOutput(failedJob.log);
  }, [jobs]);

  // Library Manager handlers
  const handleLibSearch = useCallback(async () => {
    const q = libSearchQuery.trim();
    if (!q) return;
    setLibSearching(true);
    try {
      const result = await searchLibraries(q);
      const data = (result as Record<string, unknown>)?.libraries ?? (result as Record<string, unknown>)?.data ?? [];
      setLibSearchResults(Array.isArray(data) ? data : []);
    } catch {
      toast({ variant: 'destructive', title: 'Library search failed' });
    } finally {
      setLibSearching(false);
    }
  }, [libSearchQuery, searchLibraries, toast]);

  const handleLibInstall = useCallback(async (name: string) => {
    setLibInstalling(name);
    try {
      const result = await installLibrary(name);
      if (result.success) {
        toast({ title: 'Library installed', description: name });
        refreshLibraries();
      } else {
        toast({ variant: 'destructive', title: 'Install failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Install failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLibInstalling(null);
    }
  }, [installLibrary, refreshLibraries, toast]);

  const handleLibUninstall = useCallback(async (name: string) => {
    setLibInstalling(name);
    try {
      const result = await uninstallLibrary(name);
      if (result.success) {
        toast({ title: 'Library removed', description: name });
        refreshLibraries();
      } else {
        toast({ variant: 'destructive', title: 'Uninstall failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Uninstall failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLibInstalling(null);
    }
  }, [uninstallLibrary, refreshLibraries, toast]);

  // Board Manager handlers
  const handleCoreSearch = useCallback(async () => {
    const q = coreSearchQuery.trim();
    if (!q) return;
    setCoreSearching(true);
    try {
      const result = await searchCores(q);
      const data = (result as Record<string, unknown>)?.data ?? (result as Record<string, unknown>)?.platforms ?? [];
      setCoreSearchResults(Array.isArray(data) ? data : []);
    } catch {
      toast({ variant: 'destructive', title: 'Core search failed' });
    } finally {
      setCoreSearching(false);
    }
  }, [coreSearchQuery, searchCores, toast]);

  const handleCoreInstall = useCallback(async (platform: string) => {
    setCoreInstalling(platform);
    try {
      const result = await installCore(platform);
      if (result.success) {
        toast({ title: 'Core installed', description: platform });
        refreshCores();
      } else {
        toast({ variant: 'destructive', title: 'Install failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Install failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCoreInstalling(null);
    }
  }, [installCore, refreshCores, toast]);

  const handleCoreUninstall = useCallback(async (platform: string) => {
    setCoreInstalling(platform);
    try {
      const result = await uninstallCore(platform);
      if (result.success) {
        toast({ title: 'Core removed', description: platform });
        refreshCores();
      } else {
        toast({ variant: 'destructive', title: 'Uninstall failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Uninstall failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCoreInstalling(null);
    }
  }, [uninstallCore, refreshCores, toast]);

  const filteredFiles = useMemo(
    () => files.filter(f => f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())),
    [files, searchQuery],
  );

  // Derive editor language from file extension
  const editorLanguage = useMemo((): 'cpp' | 'markdown' | 'javascript' => {
    const ext = activeFile?.language ?? '';
    if (ext === 'ino' || ext === 'cpp' || ext === 'c' || ext === 'h' || ext === 'hpp') return 'cpp';
    if (ext === 'md') return 'markdown';
    return 'javascript';
  }, [activeFile]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
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
          <Select value={selectedProfileId} onValueChange={handleProfileChange}>
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

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground border-border/50"
            onClick={handleSave}
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
            onClick={handleFormat}
            disabled={!activeFilePath || !code}
            title="Format Code (Ctrl+T)"
            data-testid="button-arduino-format"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
            disabled={!workspace || !!activeJob || !selectedProfile}
            onClick={handleCompile}
            data-testid="button-arduino-compile"
          >
            {activeJob?.jobType === 'compile' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>Verify</span>
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            disabled={!workspace || !!activeJob || !selectedProfile}
            onClick={handleUpload}
            data-testid="button-arduino-upload"
          >
            {activeJob?.jobType === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Upload</span>
          </Button>

          {/* Cancel button — visible when a job is running */}
          {activeJob && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleCancelJob}
              data-testid="button-arduino-cancel-job"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel</span>
            </Button>
          )}

          {/* Download artifact — visible when last compile succeeded */}
          {lastCompletedCompile && !activeJob && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border/50 text-muted-foreground hover:text-foreground"
              onClick={() => void handleDownloadArtifact(lastCompletedCompile.id)}
              data-testid="button-arduino-download-binary"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Binary</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: File Explorer or Examples Browser */}
        <div className="w-64 border-r border-border flex flex-col bg-card/30 shrink-0">
          {showExamples ? (
            <>
              <div className="p-2 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Examples</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowExamples(false)}
                  data-testid="button-arduino-close-examples"
                >
                  <XCircle className="w-3 h-3" />
                  Close
                </Button>
              </div>
              <ExamplesBrowser onLoadExample={handleLoadExample} className="flex-1" />
            </>
          ) : (
            <>
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sketch Files</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                    onClick={handleOpenNewFileDialog}
                    title="New file"
                    data-testid="button-arduino-new-file"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    className="pl-7 h-8 text-[11px] bg-background/50 border-border/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-arduino-file-search"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {isFilesLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 opacity-40">
                      <Loader2 className="w-4 h-4 animate-spin mb-2" />
                      <span className="text-[10px]">Loading files...</span>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="p-4 text-center text-[10px] text-muted-foreground">
                      {searchQuery ? 'No matching files' : 'No files yet — click + to create one'}
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setActiveFilePath(file.relativePath)}
                        data-testid={`file-item-${file.id}`}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                          activeFilePath === file.relativePath
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {file.language === 'ino'
                          ? <FileCode className="w-3.5 h-3.5 opacity-70 text-emerald-500 shrink-0" />
                          : <FileText className="w-3.5 h-3.5 opacity-70 shrink-0" />}
                        <span className="truncate">{file.relativePath}</span>
                        {activeFilePath === file.relativePath && isDirty && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Unsaved changes" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="mt-auto border-t border-border bg-card/50">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors group"
                  onClick={() => setShowExamples(true)}
                  data-testid="button-arduino-examples"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100" />
                    <span className="text-xs font-medium">Examples</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  className="w-full flex items-center justify-between p-3 border-t border-border hover:bg-muted/50 transition-colors group"
                  onClick={() => setBottomTab('libraries')}
                  data-testid="button-arduino-library-manager"
                >
                  <div className="flex items-center gap-2">
                    <Library className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100" />
                    <span className="text-xs font-medium">Library Manager</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  className="w-full flex items-center justify-between p-3 border-t border-border hover:bg-muted/50 transition-colors group"
                  onClick={() => setBottomTab('boards')}
                  data-testid="button-arduino-board-manager"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100" />
                    <span className="text-xs font-medium">Board Manager</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  className="w-full flex items-center justify-between p-3 border-t border-border hover:bg-muted/50 transition-colors group"
                  onClick={() => setBottomTab('serial')}
                  data-testid="button-arduino-serial-monitor"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100" />
                    <span className="text-xs font-medium">Serial Monitor</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
          {activeFilePath ? (
            <>
              {/* Tab bar */}
              <div className="flex items-center justify-between border-b border-white/5 px-2 py-1 bg-card/30 shrink-0">
                <div className="flex items-center gap-px overflow-x-auto no-scrollbar">
                  <div className="px-3 py-1.5 text-[11px] font-medium text-primary border-b border-primary bg-primary/5 whitespace-nowrap flex items-center gap-1.5">
                    {activeFilePath}
                    {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Unsaved changes" />}
                  </div>
                </div>
                {activeFile && (
                  <span className="text-[9px] text-muted-foreground px-2 tabular-nums">
                    {(activeFile.sizeBytes / 1024).toFixed(1)} KB · {editorLanguage.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  value={code}
                  onChange={handleCodeChange}
                  language={editorLanguage}
                  className="h-full"
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

          {/* Bottom Tabbed Panel */}
          <div className="h-64 border-t border-border bg-[#0a0a0a] flex flex-col shrink-0">
            {/* Tab bar */}
            <div className="flex items-center border-b border-border bg-card/50 shrink-0">
              {([
                { id: 'console' as const, label: 'Output', icon: <Terminal className="w-3 h-3" /> },
                { id: 'serial' as const, label: 'Serial Monitor', icon: <Terminal className="w-3 h-3" /> },
                { id: 'libraries' as const, label: 'Libraries', icon: <Library className="w-3 h-3" /> },
                { id: 'boards' as const, label: 'Boards', icon: <Package className="w-3 h-3" /> },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setBottomTab(tab.id)}
                  data-testid={`tab-arduino-${tab.id}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2',
                    bottomTab === tab.id
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              {bottomTab === 'console' && (
                <div className="ml-auto flex items-center gap-2 px-2">
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-white/5"
                    onClick={handleClearConsole}
                    data-testid="button-arduino-console-clear"
                  >
                    Clear
                  </button>
                  <Separator orientation="vertical" className="h-3" />
                  <button
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded hover:bg-white/5 flex items-center gap-1 transition-colors',
                      autoScroll ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setAutoScroll(v => !v)}
                    data-testid="button-arduino-autoscroll"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Auto-scroll
                  </button>
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {/* Console Tab */}
              {bottomTab === 'console' && (
                <ScrollArea className="h-full p-3 font-mono text-[11px] leading-tight text-zinc-400">
                  <div className="space-y-1">
                    {consoleLogs.map((line, i) => (
                      <div key={i} className="text-[10px] text-zinc-300">{line}</div>
                    ))}
                    {jobs.slice(0, 5).map(job => (
                      <div key={job.id} className="border-l-2 border-border pl-2 py-1 mb-2 bg-white/5 rounded-r-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <HistoryIcon className="w-3 h-3 text-muted-foreground" />
                          <span className="font-bold text-[9px] uppercase">{job.jobType}</span>
                          <span className="text-[9px] opacity-50">{new Date(job.createdAt).toLocaleTimeString()}</span>
                          <div className="flex-1" />
                          {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          {job.status === 'failed' && <XCircle className="w-3 h-3 text-destructive" />}
                          {job.status === 'cancelled' && <Ban className="w-3 h-3 text-amber-500" />}
                          {(job.status === 'running' || job.status === 'pending') && <Loader2 className="w-3 h-3 animate-spin text-primary" />}

                          {/* Per-job action buttons */}
                          {(job.status === 'running' || job.status === 'pending') && (
                            <button
                              className="text-[9px] text-destructive hover:text-destructive/80 px-1"
                              onClick={() => void cancelJob(job.id)}
                              data-testid={`button-cancel-job-${job.id}`}
                              title="Cancel this job"
                            >
                              <Square className="w-2.5 h-2.5 fill-current" />
                            </button>
                          )}
                          {job.status === 'completed' && job.jobType === 'compile' && (
                            <button
                              className="text-[9px] text-primary hover:text-primary/80 px-1"
                              onClick={() => void handleDownloadArtifact(job.id)}
                              data-testid={`button-download-artifact-${job.id}`}
                              title="Download compiled binary"
                            >
                              <Download className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <p className={cn(
                          'text-[10px]',
                          job.status === 'failed' ? 'text-destructive' : job.status === 'completed' ? 'text-emerald-400' : job.status === 'cancelled' ? 'text-amber-400' : 'text-primary',
                        )}>
                          {job.summary}
                        </p>
                        {job.log && (
                          <pre className="mt-1 text-[9px] opacity-60 overflow-x-auto whitespace-pre-wrap max-h-24 font-mono leading-relaxed border-t border-white/5 pt-1">
                            {job.log}
                          </pre>
                        )}
                      </div>
                    ))}
                    {/* Translated errors — shown when a compile job failed */}
                    {translatedErrors.length > 0 && (
                      <div className="border-l-2 border-destructive/50 pl-2 py-1.5 mb-2 bg-destructive/5 rounded-r-sm" data-testid="translated-errors-panel">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <AlertCircle className="w-3 h-3 text-destructive" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-destructive">
                            {translatedErrors.length} Issue{translatedErrors.length !== 1 ? 's' : ''} Explained
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {translatedErrors.map((t, i) => (
                            <div
                              key={i}
                              className="bg-white/5 rounded px-2 py-1.5 text-[10px]"
                              data-testid={`translated-error-${i}`}
                            >
                              <div className="flex items-start gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'h-3.5 px-1 text-[7px] shrink-0 mt-0.5',
                                    t.severity === 'error' && 'border-destructive/30 text-destructive bg-destructive/10',
                                    t.severity === 'warning' && 'border-amber-500/30 text-amber-500 bg-amber-500/10',
                                    t.severity === 'note' && 'border-blue-500/30 text-blue-500 bg-blue-500/10',
                                  )}
                                >
                                  {t.severity}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-foreground/90">{t.translated}</p>
                                  <p className="text-primary/80 mt-0.5">{t.suggestion}</p>
                                  {t.file && t.lineNumber && (
                                    <span className="text-[8px] text-muted-foreground mt-0.5 block font-mono">
                                      {t.file}:{t.lineNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {jobs.length === 0 && consoleLogs.length === 0 && (
                      <p className="opacity-30 italic">No output yet. Run Verify or Upload to see logs.</p>
                    )}
                    <div ref={consoleEndRef} />
                  </div>
                </ScrollArea>
              )}

              {/* Serial Monitor Tab */}
              {bottomTab === 'serial' && (
                <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                  <SerialMonitorPanel />
                </Suspense>
              )}

              {/* Library Manager Tab */}
              {bottomTab === 'libraries' && (
                <div className="h-full flex flex-col" data-testid="arduino-library-panel">
                  <div className="flex items-center gap-2 p-2 border-b border-border">
                    <Input
                      placeholder="Search libraries (e.g. Servo, WiFi, Adafruit NeoPixel)..."
                      className="h-7 text-xs flex-1"
                      value={libSearchQuery}
                      onChange={e => setLibSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleLibSearch(); }}
                      data-testid="input-arduino-lib-search"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => void handleLibSearch()}
                      disabled={libSearching || !libSearchQuery.trim()}
                      data-testid="button-arduino-lib-search"
                    >
                      {libSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      Search
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={refreshLibraries}
                      data-testid="button-arduino-lib-refresh"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {/* Installed libraries */}
                      {isLibrariesLoading ? (
                        <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <>
                          {(installedLibraries as Array<Record<string, unknown>>).length > 0 && (
                            <div className="mb-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Installed</span>
                              {(installedLibraries as Array<Record<string, unknown>>).map((lib, i) => {
                                const libObj = (lib as Record<string, unknown>).library as Record<string, unknown> | undefined;
                                const name = (libObj?.name ?? lib.name ?? `library-${i}`) as string;
                                const version = (libObj?.version ?? lib.version ?? '') as string;
                                return (
                                  <div key={name} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Library className="w-3 h-3 text-emerald-500 shrink-0" />
                                      <span className="font-medium truncate">{name}</span>
                                      {version && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{version}</Badge>}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-1.5"
                                      onClick={() => void handleLibUninstall(name)}
                                      disabled={libInstalling === name}
                                      data-testid={`button-lib-uninstall-${name}`}
                                    >
                                      {libInstalling === name ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                                      Remove
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Search results */}
                          {libSearchResults.length > 0 && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Search Results</span>
                              {(libSearchResults as Array<Record<string, unknown>>).map((lib, i) => {
                                const name = (lib.name ?? `result-${i}`) as string;
                                const latestVer = ((lib.latest as Record<string, unknown>)?.version ?? lib.version ?? '') as string;
                                const sentence = (lib.sentence ?? '') as string;
                                return (
                                  <div key={name} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                                    <div className="flex-1 min-w-0 mr-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium truncate">{name}</span>
                                        {latestVer && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{latestVer}</Badge>}
                                      </div>
                                      {sentence && <p className="text-[9px] text-muted-foreground truncate">{sentence}</p>}
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-6 text-[10px] gap-1 px-2"
                                      onClick={() => void handleLibInstall(name)}
                                      disabled={libInstalling === name}
                                      data-testid={`button-lib-install-${name}`}
                                    >
                                      {libInstalling === name ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                                      Install
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {installedLibraries.length === 0 && libSearchResults.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-40">
                              <Library className="w-8 h-8 mb-2" />
                              <span className="text-[10px]">Search for libraries to install, or view installed ones.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Board Manager Tab */}
              {bottomTab === 'boards' && (
                <div className="h-full flex flex-col" data-testid="arduino-board-panel">
                  <div className="flex items-center gap-2 p-2 border-b border-border">
                    <Input
                      placeholder="Search platforms (e.g. esp32, rp2040, stm32, avr)..."
                      className="h-7 text-xs flex-1"
                      value={coreSearchQuery}
                      onChange={e => setCoreSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleCoreSearch(); }}
                      data-testid="input-arduino-core-search"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => void handleCoreSearch()}
                      disabled={coreSearching || !coreSearchQuery.trim()}
                      data-testid="button-arduino-core-search"
                    >
                      {coreSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      Search
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={refreshCores}
                      data-testid="button-arduino-core-refresh"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {isCoresLoading ? (
                        <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <>
                          {/* Installed cores */}
                          {(installedCores as Array<Record<string, unknown>>).length > 0 && (
                            <div className="mb-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Installed Platforms</span>
                              {(installedCores as Array<Record<string, unknown>>).map((core, i) => {
                                const id = (core.id ?? core.ID ?? `core-${i}`) as string;
                                const name = (core.name ?? core.Name ?? id) as string;
                                const version = (core.installed ?? core.Installed ?? '') as string;
                                return (
                                  <div key={id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
                                      <span className="font-medium truncate">{name}</span>
                                      <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-mono">{id}</Badge>
                                      {version && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{String(version)}</Badge>}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-1.5"
                                      onClick={() => void handleCoreUninstall(id)}
                                      disabled={coreInstalling === id}
                                      data-testid={`button-core-uninstall-${id}`}
                                    >
                                      {coreInstalling === id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                                      Remove
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Popular platforms quick-install */}
                          {coreSearchResults.length === 0 && (
                            <div className="mb-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Popular Platforms</span>
                              {[
                                { id: 'esp32:esp32', name: 'ESP32' },
                                { id: 'rp2040:rp2040', name: 'Raspberry Pi Pico (RP2040)' },
                                { id: 'STMicroelectronics:stm32', name: 'STM32' },
                                { id: 'adafruit:nrf52', name: 'Adafruit nRF52' },
                                { id: 'arduino:avr', name: 'Arduino AVR' },
                                { id: 'arduino:megaavr', name: 'Arduino megaAVR' },
                                { id: 'arduino:samd', name: 'Arduino SAMD (Zero, MKR)' },
                              ].map(p => (
                                <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="font-medium truncate">{p.name}</span>
                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-mono">{p.id}</Badge>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px] gap-1 px-2"
                                    onClick={() => void handleCoreInstall(p.id)}
                                    disabled={coreInstalling === p.id}
                                    data-testid={`button-core-install-${p.id}`}
                                  >
                                    {coreInstalling === p.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                                    Install
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Core search results */}
                          {coreSearchResults.length > 0 && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Search Results</span>
                              {(coreSearchResults as Array<Record<string, unknown>>).map((core, i) => {
                                const id = (core.id ?? core.ID ?? `result-${i}`) as string;
                                const name = (core.name ?? core.Name ?? id) as string;
                                const latestVer = (core.latest ?? core.Latest ?? '') as string;
                                return (
                                  <div key={id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="font-medium truncate">{name}</span>
                                      <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-mono">{id}</Badge>
                                      {latestVer && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{String(latestVer)}</Badge>}
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-6 text-[10px] gap-1 px-2"
                                      onClick={() => void handleCoreInstall(id)}
                                      disabled={coreInstalling === id}
                                      data-testid={`button-core-install-search-${id}`}
                                    >
                                      {coreInstalling === id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                                      Install
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {installedCores.length === 0 && coreSearchResults.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-40">
                              <Cpu className="w-8 h-8 mb-2" />
                              <span className="text-[10px]">Install platform cores to support more boards.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New File Dialog — replaces forbidden window.prompt() */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Sketch File</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. settings.h or helpers.cpp"
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreateFile(); }}
            data-testid="input-arduino-new-file-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateFile()} disabled={!newFileName.trim()} data-testid="button-arduino-confirm-new-file">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
