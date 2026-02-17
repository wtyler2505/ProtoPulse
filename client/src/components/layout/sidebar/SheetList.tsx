import { File } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';

interface SheetListProps {
  schematicSheets: any[];
  activeSheetId: string;
  activeView: string;
  searchQuery: string;
  setActiveView: (view: any) => void;
  setActiveSheetId: (id: string) => void;
  addOutputLog: (msg: string) => void;
}

export default function SheetList({
  schematicSheets,
  activeSheetId,
  activeView,
  searchQuery,
  setActiveView,
  setActiveSheetId,
  addOutputLog,
}: SheetListProps) {
  const query = searchQuery.toLowerCase().trim();
  const filteredSheets = (schematicSheets || []).filter((s: any) =>
    !query || s.name.toLowerCase().includes(query)
  );

  return (
    <div className="pl-8 pr-2 py-1 space-y-1">
      {filteredSheets.length === 0 && query && (
        <div className="text-xs text-muted-foreground/60 py-1">No results</div>
      )}
      {filteredSheets.map((sheet: any) => (
        <ContextMenu key={sheet.id}>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                "text-xs cursor-pointer py-1 px-2 flex items-center gap-2 transition-colors",
                activeSheetId === sheet.id && activeView === 'schematic'
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => {
                setActiveView('schematic');
                setActiveSheetId(sheet.id);
              }}
            >
              <File className="w-3 h-3" />
              {sheet.name}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
            <ContextMenuItem onSelect={() => { setActiveView('schematic'); setActiveSheetId(sheet.id); }}>Open Sheet</ContextMenuItem>
            <ContextMenuItem onSelect={() => { copyToClipboard(sheet.name); addOutputLog('[SIDEBAR] Copied sheet: ' + sheet.name); }}>Copy Sheet Name</ContextMenuItem>
            <ContextMenuItem onSelect={() => { addOutputLog('[SIDEBAR] Sheet: ' + sheet.name + ' (' + sheet.components + ' components)'); }}>Sheet Info</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
