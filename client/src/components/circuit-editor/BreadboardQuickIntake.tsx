import { type FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface QuickIntakeItem {
  partName: string;
  quantity: number;
  storageLocation: string | null;
}

interface BreadboardQuickIntakeProps {
  onAdd: (item: QuickIntakeItem) => void;
}

export default function BreadboardQuickIntake({ onAdd }: BreadboardQuickIntakeProps) {
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [storageLocation, setStorageLocation] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = partName.trim();
    if (!trimmed || quantity < 1) {
      return;
    }
    onAdd({
      partName: trimmed,
      quantity,
      storageLocation: storageLocation.trim() || null,
    });
    setPartName('');
    setQuantity(1);
    setStorageLocation('');
  }

  return (
    <form
      data-testid="breadboard-quick-intake"
      onSubmit={handleSubmit}
      className="space-y-2"
    >
      <Input
        placeholder="Part name"
        value={partName}
        onChange={(e) => { setPartName(e.target.value); }}
        className="h-8 text-xs"
      />
      <div className="flex items-center gap-2">
        <Input
          data-testid="quick-intake-quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => { setQuantity(Math.max(0, Number(e.target.value))); }}
          className="h-8 w-20 text-xs"
        />
        <Input
          data-testid="quick-intake-storage"
          placeholder="Storage location"
          value={storageLocation}
          onChange={(e) => { setStorageLocation(e.target.value); }}
          className="h-8 flex-1 text-xs"
        />
        <Button
          data-testid="quick-intake-submit"
          type="submit"
          size="sm"
          className="h-8 gap-1 px-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </form>
  );
}
