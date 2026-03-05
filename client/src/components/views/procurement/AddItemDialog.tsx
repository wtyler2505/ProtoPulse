import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export interface NewItemValues {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
}

export interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newItem: NewItemValues;
  onNewItemChange: (updater: (prev: NewItemValues) => NewItemValues) => void;
  onAddItem: () => void;
}

export function AddItemDialog({ open, onOpenChange, newItem, onNewItemChange, onAddItem }: AddItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md" data-testid="dialog-add-bom-item">
        <DialogHeader>
          <DialogTitle>Add BOM Item</DialogTitle>
          <DialogDescription>Enter the component details to add to your Bill of Materials.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="add-part-number">Part Number <span className="text-destructive">*</span></Label>
            <Input
              id="add-part-number"
              placeholder="e.g. STM32F407VGT6"
              value={newItem.partNumber}
              onChange={(e) => onNewItemChange(prev => ({ ...prev, partNumber: e.target.value }))}
              data-testid="input-add-part-number"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-manufacturer">Manufacturer</Label>
              <Input
                id="add-manufacturer"
                placeholder="e.g. STMicroelectronics"
                value={newItem.manufacturer}
                onChange={(e) => onNewItemChange(prev => ({ ...prev, manufacturer: e.target.value }))}
                data-testid="input-add-manufacturer"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-supplier">Supplier</Label>
              <Select value={newItem.supplier} onValueChange={(v) => onNewItemChange(prev => ({ ...prev, supplier: v }))}>
                <SelectTrigger id="add-supplier" data-testid="select-add-supplier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Digi-Key">Digi-Key</SelectItem>
                  <SelectItem value="Mouser">Mouser</SelectItem>
                  <SelectItem value="LCSC">LCSC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-description">Description</Label>
            <Input
              id="add-description"
              placeholder="e.g. ARM Cortex-M4 MCU, 1MB Flash, 168MHz"
              value={newItem.description}
              onChange={(e) => onNewItemChange(prev => ({ ...prev, description: e.target.value }))}
              data-testid="input-add-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-quantity">Quantity</Label>
              <Input
                id="add-quantity"
                type="number"
                min={1}
                max={999999}
                value={newItem.quantity}
                onChange={(e) => onNewItemChange(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                data-testid="input-add-quantity"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-unit-price">Unit Price ($)</Label>
              <Input
                id="add-unit-price"
                type="number"
                min={0}
                max={99999.99}
                step={0.01}
                value={newItem.unitPrice}
                onChange={(e) => onNewItemChange(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                data-testid="input-add-unit-price"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-item">Cancel</Button>
          <Button onClick={onAddItem} data-testid="button-confirm-add-item">
            <Plus className="w-4 h-4 mr-2" />
            Add to BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
