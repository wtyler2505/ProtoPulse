import type { IntentHandler } from './types';

export const addBomHandler: IntentHandler = {
  match(lower) {
    return lower.includes('add to bom') || lower.includes('add bom');
  },

  handle(msgText) {
    const lower = msgText.toLowerCase().trim();
    const partMatch = lower.match(/(?:add to bom|add bom)\s+(.+)/);
    const partName = partMatch ? partMatch[1].trim() : 'Unknown Part';
    return {
      actions: [
        {
          type: 'add_bom_item',
          partNumber: partName.toUpperCase().replace(/\s+/g, '-'),
          manufacturer: 'TBD',
          description: partName,
          quantity: 1,
          unitPrice: 0,
          supplier: 'Digi-Key',
          stock: 0,
          status: 'In Stock',
        },
      ],
      response: `[ACTION] Added '${partName}' to the Bill of Materials.\n\nYou can update pricing and sourcing details in the Procurement view.`,
    };
  },
};

export const removeBomHandler: IntentHandler = {
  match(lower) {
    return lower.includes('remove from bom') || lower.includes('delete from bom');
  },

  handle(msgText, ctx) {
    const lower = msgText.toLowerCase().trim();
    const { bom } = ctx;
    const partMatch = lower.match(/(?:remove|delete) from bom\s+(.+)/);

    if (partMatch) {
      const partName = partMatch[1].trim().toLowerCase();
      const bomItem = bom.find(
        (b) => b.partNumber.toLowerCase().includes(partName) || b.description.toLowerCase().includes(partName),
      );
      if (bomItem) {
        return {
          actions: [{ type: 'remove_bom_item', partNumber: bomItem.partNumber }],
          response: `[ACTION] Removed '${bomItem.partNumber}' from the Bill of Materials.`,
        };
      }
      return {
        actions: [],
        response: `Could not find BOM item matching '${partMatch[1]}'. Check the Procurement view for current items.`,
      };
    }

    return { actions: [], response: null };
  },
};

export const exportBomHandler: IntentHandler = {
  match(lower) {
    return lower.includes('export bom') || lower.includes('export csv');
  },

  handle(_msgText, ctx) {
    const { bom, projectName } = ctx;
    if (bom.length === 0) {
      return { actions: [], response: `No BOM items to export. Add components to the BOM first.` };
    }
    return {
      actions: [{ type: 'export_bom_csv' }],
      response: `[ACTION] Exported BOM as CSV file (${bom.length} items).\n\nThe file '${projectName}_BOM.csv' has been downloaded.`,
    };
  },
};

export const optimizeBomHandler: IntentHandler = {
  match(lower) {
    return lower.includes('optimize bom') || lower.includes('optimize cost');
  },

  handle(_msgText, ctx) {
    const { bom } = ctx;
    return {
      actions: [{ type: 'optimize_bom' }],
      response: `[ACTION] BOM optimization analysis complete.\n\nSuggestions:\n• Consider alternative sourcing from LCSC for passive components (20-40% savings)\n• Consolidate resistor values to reduce unique part count\n• Check for volume pricing breaks at 1k+ quantities\n• Replace through-hole components with SMD equivalents where possible\n\nCurrent BOM has ${bom.length} items. Switch to Procurement view for details.`,
    };
  },
};
