/**
 * CalcApplyButtons — "Add to BOM" and "Apply to Component" action buttons
 * shown after a calculator produces results.
 *
 * Reads applicable actions from the CalcResult and renders the appropriate buttons.
 * Uses the BOM context to add items directly to the project's bill of materials.
 */

import { useCallback } from 'react';
import { Plus, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBom } from '@/lib/contexts/bom-context';
import { useToast } from '@/hooks/use-toast';
import {
  getApplicableActions,
  mapResultToBomItem,
  mapResultToInstanceProperty,
} from '@/lib/calculator-apply';
import type { CalcResult } from '@/lib/calculator-apply';

interface CalcApplyButtonsProps {
  /** The calculator result to apply. */
  result: CalcResult;
}

export function CalcApplyButtons({ result }: CalcApplyButtonsProps) {
  const { addBomItem } = useBom();
  const { toast } = useToast();
  const actions = getApplicableActions(result);

  const handleAddToBom = useCallback(() => {
    const bomItem = mapResultToBomItem(result);
    if (!bomItem) {
      return;
    }

    addBomItem({
      projectId: 1,
      partNumber: bomItem.partNumber,
      manufacturer: bomItem.manufacturer,
      description: bomItem.description,
      quantity: bomItem.quantity,
      unitPrice: bomItem.unitPrice,
      supplier: bomItem.supplier,
      stock: 0,
      status: bomItem.status,
      leadTime: null,
      datasheetUrl: null,
      manufacturerUrl: null,
      storageLocation: null,
      quantityOnHand: null,
      minimumStock: null,
      esdSensitive: null,
      assemblyCategory: null,
    });

    toast({
      title: 'Added to BOM',
      description: bomItem.description,
    });
  }, [result, addBomItem, toast]);

  const handleApplyToInstance = useCallback(() => {
    const prop = mapResultToInstanceProperty(result);
    if (!prop) {
      return;
    }

    // Copy the property value to the clipboard for easy pasting into a component
    void navigator.clipboard.writeText(prop.value).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: `${prop.property}: ${prop.value} — paste into a component's properties`,
      });
    }).catch(() => {
      toast({
        title: 'Property ready',
        description: `${prop.property}: ${prop.value}`,
      });
    });
  }, [result, toast]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div data-testid="calc-apply-buttons" className="flex gap-1.5 pt-1.5">
      {actions.includes('add_to_bom') && (
        <Button
          data-testid="calc-apply-bom-btn"
          size="sm"
          variant="outline"
          onClick={handleAddToBom}
          className="flex-1 text-xs h-7"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add to BOM
        </Button>
      )}
      {actions.includes('apply_to_instance') && (
        <Button
          data-testid="calc-apply-instance-btn"
          size="sm"
          variant="outline"
          onClick={handleApplyToInstance}
          className="flex-1 text-xs h-7"
        >
          <Cpu className="w-3 h-3 mr-1" />
          Apply to Component
        </Button>
      )}
    </div>
  );
}
