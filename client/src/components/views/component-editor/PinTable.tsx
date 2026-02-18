import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, Pin } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { Connector } from '@shared/component-types';

function PinRow({ connector, index }: { connector: Connector; index: number }) {
  const { dispatch } = useComponentEditor();

  const update = (updates: Partial<Connector>) => {
    dispatch({ type: 'UPDATE_CONNECTOR', payload: { connectorId: connector.id, updates } });
  };

  return (
    <tr data-testid={`pin-row-${connector.id}`} className="border-b border-border hover:bg-muted/30">
      <td className="px-3 py-1.5 text-muted-foreground text-sm">{index + 1}</td>
      <td className="px-3 py-1.5">
        <Input
          data-testid={`input-pin-name-${connector.id}`}
          value={connector.name}
          onChange={(e) => update({ name: e.target.value })}
          className="h-7 bg-card border-border text-sm"
        />
      </td>
      <td className="px-3 py-1.5">
        <Select
          value={connector.connectorType}
          onValueChange={(val) => update({ connectorType: val as Connector['connectorType'] })}
        >
          <SelectTrigger data-testid={`select-pin-type-${connector.id}`} className="h-7 bg-card border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="male">male</SelectItem>
            <SelectItem value="female">female</SelectItem>
            <SelectItem value="pad">pad</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-1.5">
        <Input
          data-testid={`input-pin-description-${connector.id}`}
          value={connector.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
          className="h-7 bg-card border-border text-sm"
          placeholder="—"
        />
      </td>
      <td className="px-3 py-1.5">
        {connector.padSpec ? (
          <Select
            value={connector.padSpec.type}
            onValueChange={(val) =>
              update({ padSpec: { ...connector.padSpec!, type: val as 'tht' | 'smd' } })
            }
          >
            <SelectTrigger className="h-7 bg-card border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="tht">tht</SelectItem>
              <SelectItem value="smd">smd</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        {connector.padSpec ? (
          <Select
            value={connector.padSpec.shape}
            onValueChange={(val) =>
              update({ padSpec: { ...connector.padSpec!, shape: val as 'circle' | 'rect' | 'oblong' | 'square' } })
            }
          >
            <SelectTrigger className="h-7 bg-card border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="circle">circle</SelectItem>
              <SelectItem value="rect">rect</SelectItem>
              <SelectItem value="oblong">oblong</SelectItem>
              <SelectItem value="square">square</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          data-testid={`button-delete-pin-${connector.id}`}
          onClick={() => dispatch({ type: 'DELETE_CONNECTOR', payload: connector.id })}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </td>
    </tr>
  );
}

export default function PinTable() {
  const { state, dispatch } = useComponentEditor();
  const connectors = state.present.connectors;

  const addPin = () => {
    dispatch({
      type: 'ADD_CONNECTOR',
      payload: {
        id: nanoid(),
        name: `pin${connectors.length + 1}`,
        connectorType: 'pad',
        shapeIds: {},
        terminalPositions: {},
      },
    });
  };

  if (connectors.length === 0) {
    return (
      <div data-testid="empty-pin-table" className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <Pin className="w-10 h-10 text-muted-foreground/50" />
        <p className="text-muted-foreground text-sm text-center max-w-md">
          No pins defined yet. Add pins to define the component's electrical connections.
        </p>
        <Button data-testid="button-add-pin" onClick={addPin} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Pin
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="pin-table" className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50 sticky top-0">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-12">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-28">Pad Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">Pad Shape</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {connectors.map((c, i) => (
              <PinRow key={c.id} connector={c} index={i} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-3">
        <Button data-testid="button-add-pin" variant="outline" onClick={addPin} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Pin
        </Button>
      </div>
    </div>
  );
}
