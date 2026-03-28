import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  FileCode,
  FileText,
  Plus,
  ChevronRight,
  Loader2,
  XCircle,
  Search,
  Package,
  BookOpen,
  Library,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ExamplesBrowser from '@/components/views/arduino/ExamplesBrowser';
import ExampleLibraryPanel from '@/components/arduino/ExampleLibraryPanel';
import type { ArduinoSketchFile } from '@shared/schema';
import type { BottomTab } from './types';

interface ArduinoFileExplorerProps {
  files: ArduinoSketchFile[];
  isFilesLoading: boolean;
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  isDirty: boolean;
  showExamples: boolean;
  onShowExamples: (show: boolean) => void;
  showExampleLibrary: boolean;
  onShowExampleLibrary: (show: boolean) => void;
  onLoadExample: (code: string, title: string) => void;
  onOpenNewFileDialog: () => void;
  onSetBottomTab: (tab: BottomTab) => void;
}

export default function ArduinoFileExplorer({
  files,
  isFilesLoading,
  activeFilePath,
  onSelectFile,
  isDirty,
  showExamples,
  onShowExamples,
  showExampleLibrary,
  onShowExampleLibrary,
  onLoadExample,
  onOpenNewFileDialog,
  onSetBottomTab,
}: ArduinoFileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(
    () => files.filter(f => f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())),
    [files, searchQuery],
  );

  return (
    <div className="w-64 border-r border-border flex flex-col bg-card/30 shrink-0">
      {showExampleLibrary ? (
        <>
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Example Library</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => onShowExampleLibrary(false)}
              data-testid="button-arduino-close-example-library"
            >
              <XCircle className="w-3 h-3" />
              Close
            </Button>
          </div>
          <ExampleLibraryPanel onLoadExample={onLoadExample} className="flex-1" />
        </>
      ) : showExamples ? (
        <>
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Examples</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => onShowExamples(false)}
              data-testid="button-arduino-close-examples"
            >
              <XCircle className="w-3 h-3" />
              Close
            </Button>
          </div>
          <ExamplesBrowser onLoadExample={onLoadExample} className="flex-1" />
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
                onClick={onOpenNewFileDialog}
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
                    onClick={() => onSelectFile(file.relativePath)}
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
              onClick={() => onShowExamples(true)}
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
              onClick={() => onShowExampleLibrary(true)}
              data-testid="button-arduino-example-library"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100" />
                <span className="text-xs font-medium">Example Library</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              className="w-full flex items-center justify-between p-3 border-t border-border hover:bg-muted/50 transition-colors group"
              onClick={() => onSetBottomTab('libraries')}
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
              onClick={() => onSetBottomTab('boards')}
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
              onClick={() => onSetBottomTab('serial')}
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
  );
}
