import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import { Search, Plus, Trash2, Cpu, ChevronRight, Download, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getBoardSettingsManager,
  PROGRAMMERS,
  UPLOAD_SPEEDS,
  validateFqbn,
} from '@/lib/arduino/board-settings';
import type { BoardPreset } from '@/lib/arduino/board-settings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BoardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BoardSettingsDialog({ open, onOpenChange }: BoardSettingsDialogProps) {
  const manager = getBoardSettingsManager();
  const settings = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  // Local draft state (committed on Save)
  const [draftFqbn, setDraftFqbn] = useState(settings.selectedFqbn);
  const [draftProgrammer, setDraftProgrammer] = useState(settings.programmer);
  const [draftUploadSpeed, setDraftUploadSpeed] = useState(String(settings.uploadSpeed));
  const [draftExtraFlags, setDraftExtraFlags] = useState(settings.extraFlags);

  // Board search
  const [searchQuery, setSearchQuery] = useState('');

  // Custom board form
  const [customFqbn, setCustomFqbn] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPlatform, setCustomPlatform] = useState('');
  const [customArch, setCustomArch] = useState('');
  const [customError, setCustomError] = useState('');

  // Sync draft from manager when dialog opens
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      const current = manager.getCurrentSettings();
      setDraftFqbn(current.selectedFqbn);
      setDraftProgrammer(current.programmer);
      setDraftUploadSpeed(String(current.uploadSpeed));
      setDraftExtraFlags(current.extraFlags);
      setSearchQuery('');
      setCustomFqbn('');
      setCustomName('');
      setCustomPlatform('');
      setCustomArch('');
      setCustomError('');
    }
    onOpenChange(nextOpen);
  }, [manager, onOpenChange]);

  // Grouped presets filtered by search
  const groupedPresets = useMemo(() => {
    const all = manager.getPresets();
    const lowerQ = searchQuery.toLowerCase().trim();
    const filtered = lowerQ.length === 0
      ? all
      : all.filter(
          (p) =>
            p.name.toLowerCase().includes(lowerQ) ||
            p.fqbn.toLowerCase().includes(lowerQ) ||
            p.platform.toLowerCase().includes(lowerQ),
        );

    const groups = new Map<string, BoardPreset[]>();
    for (const preset of filtered) {
      const existing = groups.get(preset.platform);
      if (existing) {
        existing.push(preset);
      } else {
        groups.set(preset.platform, [preset]);
      }
    }
    return groups;
  }, [manager, searchQuery, settings.customBoards]);

  // Handlers
  const handleSave = useCallback(() => {
    manager.selectBoard(draftFqbn);
    manager.setProgrammer(draftProgrammer);
    const speed = Number(draftUploadSpeed);
    if (Number.isFinite(speed) && speed > 0) {
      manager.setUploadSpeed(speed);
    }
    manager.setExtraFlags(draftExtraFlags);
    onOpenChange(false);
  }, [manager, draftFqbn, draftProgrammer, draftUploadSpeed, draftExtraFlags, onOpenChange]);

  const handleAddCustomBoard = useCallback(() => {
    setCustomError('');

    if (!validateFqbn(customFqbn)) {
      setCustomError('Invalid FQBN format. Expected: vendor:arch:board');
      return;
    }
    if (customName.trim().length === 0) {
      setCustomError('Board name is required.');
      return;
    }

    const platform = customPlatform.trim() || 'Custom';
    const arch = customArch.trim() || customFqbn.split(':')[1] || 'unknown';

    const success = manager.addCustomBoard({
      fqbn: customFqbn,
      name: customName.trim(),
      platform,
      arch,
    });

    if (!success) {
      setCustomError('A board with this FQBN already exists.');
      return;
    }

    setCustomFqbn('');
    setCustomName('');
    setCustomPlatform('');
    setCustomArch('');
  }, [manager, customFqbn, customName, customPlatform, customArch]);

  const handleRemoveCustomBoard = useCallback(
    (fqbn: string) => {
      manager.removeCustomBoard(fqbn);
      if (draftFqbn === fqbn) {
        setDraftFqbn('arduino:avr:uno');
      }
    },
    [manager, draftFqbn],
  );

  const handleExport = useCallback(() => {
    const json = manager.exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'board-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [manager]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        if (typeof text === 'string') {
          const success = manager.importSettings(text);
          if (success) {
            const current = manager.getCurrentSettings();
            setDraftFqbn(current.selectedFqbn);
            setDraftProgrammer(current.programmer);
            setDraftUploadSpeed(String(current.uploadSpeed));
            setDraftExtraFlags(current.extraFlags);
          }
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [manager]);

  const isCustomBoard = useCallback(
    (fqbn: string) => settings.customBoards.some((b) => b.fqbn === fqbn),
    [settings.customBoards],
  );

  const selectedPreset = manager.findPreset(draftFqbn);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="board-settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[var(--color-editor-accent)]" />
            Board Settings
          </DialogTitle>
          <DialogDescription>
            Select your target board, programmer, and upload configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Board Picker */}
          <div className="space-y-2">
            <Label>Board</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="board-search-input"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-1">
                {Array.from(groupedPresets.entries()).map(([platform, presets]) => (
                  <div key={platform}>
                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <ChevronRight className="h-3 w-3" />
                      {platform}
                    </div>
                    {presets.map((preset) => (
                      <button
                        key={preset.fqbn}
                        type="button"
                        data-testid={`board-option-${preset.fqbn}`}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-1.5 rounded-sm text-sm cursor-pointer transition-colors',
                          draftFqbn === preset.fqbn
                            ? 'bg-[var(--color-editor-accent)]/10 text-[var(--color-editor-accent)]'
                            : 'hover:bg-muted/50',
                        )}
                        onClick={() => {
                          setDraftFqbn(preset.fqbn);
                          if (preset.uploadSpeed) {
                            setDraftUploadSpeed(String(preset.uploadSpeed));
                          }
                          if (preset.programmer) {
                            setDraftProgrammer(preset.programmer);
                          }
                        }}
                      >
                        <span className="truncate">{preset.name}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground font-mono">{preset.fqbn}</span>
                          {isCustomBoard(preset.fqbn) && (
                            <button
                              type="button"
                              data-testid={`remove-custom-board-${preset.fqbn}`}
                              className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCustomBoard(preset.fqbn);
                              }}
                              aria-label={`Remove ${preset.name}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {groupedPresets.size === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4" data-testid="board-no-results">
                    No boards match your search.
                  </div>
                )}
              </div>
            </ScrollArea>
            {selectedPreset && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">{selectedPreset.arch}</Badge>
                <span>{selectedPreset.name}</span>
                <span className="font-mono">{selectedPreset.fqbn}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Programmer + Upload Speed row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="programmer-select">Programmer</Label>
              <Select
                value={draftProgrammer}
                onValueChange={setDraftProgrammer}
              >
                <SelectTrigger id="programmer-select" data-testid="programmer-select">
                  <SelectValue placeholder="Select programmer" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMMERS.map((prog) => (
                    <SelectItem key={prog} value={prog} data-testid={`programmer-option-${prog}`}>
                      {prog}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-speed-select">Upload Speed</Label>
              <Select
                value={draftUploadSpeed}
                onValueChange={setDraftUploadSpeed}
              >
                <SelectTrigger id="upload-speed-select" data-testid="upload-speed-select">
                  <SelectValue placeholder="Select speed" />
                </SelectTrigger>
                <SelectContent>
                  {UPLOAD_SPEEDS.map((speed) => (
                    <SelectItem key={speed} value={String(speed)} data-testid={`speed-option-${String(speed)}`}>
                      {speed.toLocaleString()} baud
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Extra Flags */}
          <div className="space-y-2">
            <Label htmlFor="extra-flags-textarea">Extra Compiler Flags</Label>
            <Textarea
              id="extra-flags-textarea"
              data-testid="extra-flags-textarea"
              placeholder="-DDEBUG -Os"
              value={draftExtraFlags}
              onChange={(e) => setDraftExtraFlags(e.target.value)}
              rows={2}
              className="font-mono text-xs resize-none"
            />
          </div>

          <Separator />

          {/* Add Custom Board */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Custom Board</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                data-testid="custom-board-fqbn"
                placeholder="vendor:arch:board"
                value={customFqbn}
                onChange={(e) => setCustomFqbn(e.target.value)}
                className="font-mono text-xs"
              />
              <Input
                data-testid="custom-board-name"
                placeholder="Board name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <Input
                data-testid="custom-board-platform"
                placeholder="Platform (optional)"
                value={customPlatform}
                onChange={(e) => setCustomPlatform(e.target.value)}
              />
              <Input
                data-testid="custom-board-arch"
                placeholder="Architecture (optional)"
                value={customArch}
                onChange={(e) => setCustomArch(e.target.value)}
              />
            </div>
            {customError && (
              <p className="text-xs text-destructive" data-testid="custom-board-error">{customError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              data-testid="add-custom-board-button"
              onClick={handleAddCustomBoard}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Board
            </Button>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" data-testid="export-settings-button" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button variant="ghost" size="sm" data-testid="import-settings-button" onClick={handleImport}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Import
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" data-testid="board-settings-cancel" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button data-testid="board-settings-save" onClick={handleSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
