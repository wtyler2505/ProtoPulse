import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SafeCommand {
  id: string;
  name: string;
  payload: string;
}

const DEFAULT_COMMANDS: SafeCommand[] = [
  { id: '1', name: 'Ping', payload: '{"cmd":"ping"}' },
  { id: '2', name: 'Get Info', payload: '{"cmd":"info"}' },
  { id: '3', name: 'Reset', payload: '{"cmd":"reset"}' }
];

export default function DeviceCommandSandbox({
  onSendCommand,
  disabled
}: {
  onSendCommand: (cmd: string) => void;
  disabled: boolean;
}) {
  const [commands, setCommands] = useState<SafeCommand[]>(() => {
    try {
      const stored = localStorage.getItem('protopulse-safe-commands');
      return stored ? JSON.parse(stored) : DEFAULT_COMMANDS;
    } catch {
      return DEFAULT_COMMANDS;
    }
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPayload, setNewPayload] = useState('');

  const saveCommands = (newCommands: SafeCommand[]) => {
    setCommands(newCommands);
    try {
      localStorage.setItem('protopulse-safe-commands', JSON.stringify(newCommands));
    } catch {
      // ignore
    }
  };

  const handleAdd = () => {
    if (!newName.trim() || !newPayload.trim()) return;
    saveCommands([
      ...commands,
      { id: crypto.randomUUID(), name: newName, payload: newPayload }
    ]);
    setNewName('');
    setNewPayload('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    saveCommands(commands.filter(c => c.id !== id));
  };

  return (
    <div className="border-t border-border bg-muted/10 p-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Safe Commands</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 px-1.5 text-[10px]"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      
      {isAdding && (
        <div className="flex items-center gap-2 bg-background/50 p-1.5 rounded-sm border border-border">
          <Input 
            placeholder="Name (e.g. Turn On LED)" 
            className="h-6 text-[10px]"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input 
            placeholder="Payload (e.g. 1)" 
            className="h-6 text-[10px] font-mono"
            value={newPayload}
            onChange={(e) => setNewPayload(e.target.value)}
          />
          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleAdd}>Save</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {commands.map((cmd) => (
          <div key={cmd.id} className="flex items-center bg-primary/10 border border-primary/20 rounded-md overflow-hidden group">
            <button
              disabled={disabled}
              className="px-2 py-1 text-[11px] text-primary hover:bg-primary/20 transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50"
              onClick={() => onSendCommand(cmd.payload)}
              title={cmd.payload}
            >
              <Play className="w-3 h-3" />
              {cmd.name}
            </button>
            <button
              className="px-1.5 py-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
              onClick={() => handleDelete(cmd.id)}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {commands.length === 0 && (
          <span className="text-[10px] text-muted-foreground/60 italic p-1">No saved commands. Add one above.</span>
        )}
      </div>
    </div>
  );
}