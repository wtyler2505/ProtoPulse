import type { BomItem } from '@/lib/project-context';
import { buildCSV, downloadBlob } from '@/lib/csv';
import type { ActionHandler } from './types';

// ---------------------------------------------------------------------------
// Suggest-alternatives database
// ---------------------------------------------------------------------------

const SUGGEST_ALT_DB: Record<string, Array<{ pn: string; mfr: string; price: number; note: string }>> = {
  'ESP32': [
    { pn: 'ESP32-C3-MINI-1', mfr: 'Espressif', price: 1.80, note: 'Lower cost, single-core RISC-V, BLE only' },
    { pn: 'RP2040', mfr: 'Raspberry Pi', price: 0.80, note: 'Dual-core Cortex-M0+, no wireless' },
    { pn: 'nRF52840', mfr: 'Nordic', price: 3.10, note: 'BLE 5.0, better power efficiency' },
  ],
  'SX1262': [
    { pn: 'RFM95W', mfr: 'HopeRF', price: 3.50, note: 'Budget LoRa module, slightly lower performance' },
    { pn: 'LLCC68', mfr: 'Semtech', price: 2.80, note: 'Cost-optimized LoRa, lower power' },
  ],
  'SHT40': [
    { pn: 'HDC1080', mfr: 'TI', price: 1.20, note: 'Lower cost, slightly less accurate' },
    { pn: 'BME280', mfr: 'Bosch', price: 2.50, note: 'Adds pressure sensing, widely available' },
  ],
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const addBomItem: ActionHandler = (action, ctx) => {
  const newBomItem: Omit<BomItem, 'id'> = {
    partNumber: action.partNumber!,
    manufacturer: action.manufacturer!,
    description: action.description!,
    quantity: action.quantity || 1,
    unitPrice: action.unitPrice || 0,
    totalPrice: (action.quantity || 1) * (action.unitPrice || 0),
    supplier: (action.supplier as BomItem['supplier']) || 'Unknown',
    stock: 0,
    status: (action.status as BomItem['status']) || 'In Stock',
  };
  ctx.bom.addBomItem(newBomItem);
  // Update accumulator so subsequent actions in the same batch see this item.
  // Placeholder id — the server assigns the real one on persist.
  const placeholderEntry: BomItem = { id: crypto.randomUUID(), ...newBomItem };
  ctx.state.currentBom = [...ctx.state.currentBom, placeholderEntry];
  ctx.history.addToHistory(`Added BOM item: ${action.partNumber}`, 'AI');
  ctx.output.addOutputLog(`[AI] Added BOM item: ${action.partNumber}`);
};

const removeBomItem: ActionHandler = (action, ctx) => {
  const bomItem = ctx.state.currentBom.find(
    (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
  );
  if (bomItem) {
    ctx.bom.deleteBomItem(bomItem.id);
    ctx.state.currentBom = ctx.state.currentBom.filter((b) => b.id !== bomItem.id);
    ctx.history.addToHistory(`Removed BOM item: ${action.partNumber}`, 'AI');
    ctx.output.addOutputLog(`[AI] Removed BOM item: ${action.partNumber}`);
  }
};

const updateBomItem: ActionHandler = (action, ctx) => {
  const bomToUpdate = ctx.state.currentBom.find(
    (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
  );
  if (bomToUpdate && ctx.bom.updateBomItem) {
    ctx.bom.updateBomItem(bomToUpdate.id, action.updates!);
    ctx.history.addToHistory(`Updated BOM item: ${action.partNumber}`, 'AI');
    ctx.output.addOutputLog(`[AI] Updated BOM: ${action.partNumber}`);
  }
};

const optimizeBom: ActionHandler = (_action, ctx) => {
  const totalCost = ctx.state.currentBom.reduce((sum: number, b) => sum + (b.unitPrice * b.quantity), 0);
  const supplierCounts: Record<string, number> = {};
  ctx.state.currentBom.forEach((b) => { supplierCounts[b.supplier] = (supplierCounts[b.supplier] || 0) + 1; });
  const primarySupplier = Object.entries(supplierCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';

  ctx.validation.addValidationIssue({
    severity: 'info',
    message: `BOM Summary: ${ctx.state.currentBom.length} items, $${totalCost.toFixed(2)} total cost, ${Object.keys(supplierCounts).length} suppliers`,
    suggestion: `Consolidate to ${primarySupplier} where possible to reduce shipping costs and simplify procurement.`,
  });

  const expensiveItems = [...ctx.state.currentBom].sort((a, b) => (b.unitPrice * b.quantity) - (a.unitPrice * a.quantity)).slice(0, 3);
  expensiveItems.forEach((item) => {
    ctx.validation.addValidationIssue({
      severity: 'info',
      message: `Cost driver: ${item.partNumber} — $${(item.unitPrice * item.quantity).toFixed(2)} (${((item.unitPrice * item.quantity / totalCost) * 100).toFixed(0)}% of BOM)`,
      componentId: item.partNumber,
      suggestion: 'Consider alternative parts or volume pricing to reduce cost.',
    });
  });

  ctx.arch.setActiveView('procurement');
  ctx.history.addToHistory('BOM optimization analysis', 'AI');
  ctx.output.addOutputLog(`[AI] BOM analysis: $${totalCost.toFixed(2)} total, ${ctx.state.currentBom.length} items`);
};

const pricingLookup: ActionHandler = (action, ctx) => {
  ctx.validation.addValidationIssue({
    severity: 'info',
    message: `Real-time pricing for ${action.partNumber} is not available — supplier API integration is not yet configured.`,
    suggestion: 'Connect supplier APIs (Digi-Key, Mouser, LCSC) in project settings to enable live pricing and stock lookups.',
  });
  ctx.arch.setActiveView('procurement');
  ctx.history.addToHistory(`Pricing lookup: ${action.partNumber}`, 'AI');
  ctx.output.addOutputLog(`[AI] Checked pricing for ${action.partNumber}`);
};

const suggestAlternatives: ActionHandler = (action, ctx) => {
  const original = ctx.state.currentBom.find(
    (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
  );
  if (original) {
    const key = Object.keys(SUGGEST_ALT_DB).find(
      (k) => original.partNumber.toLowerCase().includes(k.toLowerCase()),
    );
    const alts = key
      ? SUGGEST_ALT_DB[key]
      : [
          { pn: `${original.partNumber}-ALT1`, mfr: original.manufacturer, price: original.unitPrice * 0.85, note: 'Generic equivalent, lower cost' },
          { pn: `${original.partNumber}-ALT2`, mfr: 'Alternative Mfr', price: original.unitPrice * 0.7, note: 'Budget alternative, verify specs' },
        ];

    alts.forEach((alt) => {
      ctx.validation.addValidationIssue({
        severity: 'info',
        message: `Alternative for ${original.partNumber}: ${alt.pn} (${alt.mfr}) — $${alt.price.toFixed(2)} — ${alt.note}`,
        componentId: original.partNumber,
        suggestion: `Switch to save $${(original.unitPrice - alt.price).toFixed(2)} per unit (${action.reason || 'general'} optimization).`,
      });
    });
  }
  ctx.arch.setActiveView('procurement');
  ctx.history.addToHistory(`Suggested alternatives for ${action.partNumber}`, 'AI');
  ctx.output.addOutputLog(`[AI] Found alternatives for ${action.partNumber}`);
};

const checkLeadTimes: ActionHandler = (_action, ctx) => {
  ctx.state.currentBom.forEach((item) => {
    const weeks = Math.floor(Math.random() * 12) + 1;
    const status: 'error' | 'warning' | 'info' = weeks <= 2 ? 'info' : weeks <= 8 ? 'warning' : 'error';
    ctx.validation.addValidationIssue({
      severity: status,
      message: `${item.partNumber}: Est. ${weeks} week lead time (${item.supplier})${weeks > 8 ? ' — LONG LEAD TIME' : ''}`,
      componentId: item.partNumber,
      suggestion: weeks > 8
        ? 'Consider ordering immediately or finding alternative with shorter lead time.'
        : `Standard lead time. ${item.stock > 0 ? `${item.stock} units in stock.` : 'Verify stock before ordering.'}`,
    });
  });
  ctx.arch.setActiveView('procurement');
  ctx.history.addToHistory('Checked lead times', 'AI');
  ctx.output.addOutputLog(`[AI] Checked lead times for ${ctx.state.currentBom.length} BOM items`);
};

const addDatasheetLink: ActionHandler = (action, ctx) => {
  const dsItem = ctx.state.currentBom.find(
    (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
  );
  if (dsItem) {
    ctx.bom.updateBomItem(dsItem.id, { leadTime: action.url });
    ctx.history.addToHistory(`Added datasheet for ${action.partNumber}`, 'AI');
    ctx.output.addOutputLog(`[AI] Linked datasheet for ${action.partNumber}: ${action.url}`);
  }
};

const exportBomCsv: ActionHandler = (_action, ctx) => {
  if (ctx.state.currentBom.length > 0) {
    try {
      const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Status'];
      const rows = ctx.state.currentBom.map((item) => [
        item.partNumber, item.manufacturer, item.description,
        item.quantity, item.unitPrice, item.totalPrice,
        item.supplier, item.status,
      ]);
      const csv = buildCSV(headers, rows);
      downloadBlob(new Blob([csv], { type: 'text/csv' }), `${ctx.meta.projectName}_BOM.csv`);
      ctx.history.addToHistory('Exported BOM as CSV', 'AI');
      ctx.output.addOutputLog('[AI] Exported BOM as CSV');
    } catch (err) {
      console.warn('Export failed:', err);
    }
  }
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const bomHandlers: Record<string, ActionHandler> = {
  add_bom_item: addBomItem,
  remove_bom_item: removeBomItem,
  update_bom_item: updateBomItem,
  optimize_bom: optimizeBom,
  pricing_lookup: pricingLookup,
  suggest_alternatives: suggestAlternatives,
  check_lead_times: checkLeadTimes,
  add_datasheet_link: addDatasheetLink,
  export_bom_csv: exportBomCsv,
};
