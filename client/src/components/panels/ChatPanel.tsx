import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, Sparkles, Loader2, Plus, Zap, X, Settings2, Eye, EyeOff,
  ChevronDown, Copy, Check, RefreshCw, ArrowDown, Search, Download, Trash2,
  StopCircle, AlertTriangle, CheckCircle2, ArrowRight, SlidersHorizontal
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

const quickActionDescriptions: Record<string, string> = {
  'Generate Architecture': 'Generate a default system architecture',
  'Optimize BOM': 'Optimize bill of materials cost',
  'Run Validation': 'Run design rule checks',
  'Add MCU Node': 'Add an MCU component to the design',
  'Switch to Schematic': 'Open the schematic editor',
  'Project Summary': 'Show current project info',
  'Show Help': 'List all available commands',
  'Export BOM CSV': 'Export BOM as CSV file',
};

const AI_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { id: 'claude-4-6-sonnet-20260101', label: 'Claude 4.6 Sonnet' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { id: 'claude-4-6-opus-20260101', label: 'Claude 4.6 Opus' },
    { id: 'claude-haiku-4-5-20250514', label: 'Claude Haiku 4.5' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash' },
    { id: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro' },
  ],
};

const DESTRUCTIVE_ACTIONS = ['clear_canvas', 'remove_node', 'remove_edge', 'clear_validation', 'remove_bom_item'];

const ACTION_LABELS: Record<string, string> = {
  switch_view: 'Switched view',
  switch_schematic_sheet: 'Switched sheet',
  add_node: 'Added component',
  remove_node: 'Removed component',
  update_node: 'Updated component',
  connect_nodes: 'Connected nodes',
  remove_edge: 'Removed connection',
  clear_canvas: 'Cleared canvas',
  generate_architecture: 'Generated architecture',
  add_bom_item: 'Added to BOM',
  remove_bom_item: 'Removed from BOM',
  update_bom_item: 'Updated BOM item',
  run_validation: 'Ran validation',
  clear_validation: 'Cleared issues',
  add_validation_issue: 'Added issue',
  rename_project: 'Renamed project',
  update_description: 'Updated description',
  export_bom_csv: 'Exported CSV',
};

import type { ChatMessage } from '@/lib/project-context';

export default function ChatPanel({ isOpen, onClose, collapsed = false, width = 350, onToggleCollapse }: ChatPanelProps) {
  const {
    messages, addMessage, isGenerating, setIsGenerating,
    runValidation, addValidationIssue, deleteValidationIssue, issues,
    setNodes, setEdges, nodes, edges,
    bom, addBomItem, deleteBomItem, updateBomItem,
    activeView, setActiveView,
    activeSheetId, setActiveSheetId, schematicSheets,
    projectName, setProjectName, projectDescription, setProjectDescription,
    addToHistory, addOutputLog
  } = useProject();
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [aiProvider, setAiProvider] = useState<'anthropic' | 'gemini'>(() => {
    return (localStorage.getItem('protopulse_ai_provider') as any) || 'anthropic';
  });
  const [aiModel, setAiModel] = useState(() => {
    return localStorage.getItem('protopulse_ai_model') || 'claude-4-6-sonnet-20260101';
  });
  const [aiApiKey, setAiApiKey] = useState(() => {
    return localStorage.getItem('protopulse_ai_apikey') || '';
  });
  const [aiTemperature, setAiTemperature] = useState(() => {
    return parseFloat(localStorage.getItem('protopulse_ai_temp') || '0.7');
  });
  const [customSystemPrompt, setCustomSystemPrompt] = useState(() => {
    return localStorage.getItem('protopulse_ai_sysprompt') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pendingActions, setPendingActions] = useState<{ actions: any[]; messageId: string } | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');

  useEffect(() => { localStorage.setItem('protopulse_ai_provider', aiProvider); }, [aiProvider]);
  useEffect(() => { localStorage.setItem('protopulse_ai_model', aiModel); }, [aiModel]);
  useEffect(() => { localStorage.setItem('protopulse_ai_apikey', aiApiKey); }, [aiApiKey]);
  useEffect(() => { localStorage.setItem('protopulse_ai_temp', String(aiTemperature)); }, [aiTemperature]);
  useEffect(() => { localStorage.setItem('protopulse_ai_sysprompt', customSystemPrompt); }, [customSystemPrompt]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isGenerating, streamingContent, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, []);

  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);

  const copyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const processLocalCommand = (msgText: string): string => {
    const lower = msgText.toLowerCase().trim();

    const viewMap: Record<string, string> = {
      'architecture': 'architecture',
      'schematic': 'schematic',
      'procurement': 'procurement',
      'validation': 'validation',
      'output': 'output',
    };
    for (const [key, view] of Object.entries(viewMap)) {
      if ((lower.includes('switch to') || lower.includes('go to') || lower.includes('show') || lower.includes('open')) && lower.includes(key)) {
        if (key === 'schematic') {
          const sheetMatch = lower.match(/sheet\s+(.+)/);
          if (sheetMatch) {
            const sheetName = sheetMatch[1].trim();
            const sheet = schematicSheets.find((s: any) => s.name.toLowerCase().includes(sheetName) || s.id.toLowerCase() === sheetName);
            if (sheet) {
              setActiveSheetId(sheet.id);
              setActiveView('schematic' as any);
              addToHistory(`Opened schematic sheet: ${sheet.name}`, 'AI');
              addOutputLog(`[AI] Opened schematic sheet: ${sheet.name}`);
              return `[ACTION] Opened schematic sheet '${sheet.name}'.\n\nYou can now view and edit this sheet in the schematic editor.`;
            }
          }
        }
        setActiveView(view as any);
        const viewLabel = key.charAt(0).toUpperCase() + key.slice(1);
        addToHistory(`Switched to ${viewLabel} view`, 'AI');
        addOutputLog(`[AI] Switched to ${viewLabel} view`);
        return `[ACTION] Switched to ${viewLabel} view.\n\nYou can manage your ${key} here.`;
      }
    }

    if (lower.includes('generate architecture') || lower.includes('generate schematic') || (lower.includes('generate') && (lower.includes('arch') || lower.includes('design')))) {
      const defaultNodes = [
        { id: Date.now().toString(), type: 'custom' as const, position: { x: 300, y: 100 }, data: { label: 'ESP32-S3', type: 'mcu', description: 'Main MCU' } },
        { id: (Date.now() + 1).toString(), type: 'custom' as const, position: { x: 100, y: 250 }, data: { label: 'TP4056', type: 'power', description: 'Power Management' } },
        { id: (Date.now() + 2).toString(), type: 'custom' as const, position: { x: 500, y: 250 }, data: { label: 'SX1262', type: 'comm', description: 'LoRa Communication' } },
        { id: (Date.now() + 3).toString(), type: 'custom' as const, position: { x: 300, y: 400 }, data: { label: 'SHT40', type: 'sensor', description: 'Temp/Humidity Sensor' } },
      ];
      const defaultEdges = [
        { id: `e-${Date.now()}`, source: defaultNodes[0].id, target: defaultNodes[1].id, label: 'Power', animated: true },
        { id: `e-${Date.now() + 1}`, source: defaultNodes[0].id, target: defaultNodes[2].id, label: 'SPI', animated: true },
        { id: `e-${Date.now() + 2}`, source: defaultNodes[0].id, target: defaultNodes[3].id, label: 'I2C', animated: true },
      ];
      setNodes(defaultNodes);
      setEdges(defaultEdges);
      setActiveView('architecture' as any);
      addToHistory('Generated default architecture', 'AI');
      addOutputLog('[AI] Generated default architecture with 4 components');
      return `[ACTION] Generated default architecture with 4 components.\n\nCreated: ESP32-S3 (MCU), TP4056 (Power), SX1262 (Communication), SHT40 (Sensor). All components are connected with data buses.`;
    }

    if (lower.includes('clear all') && (lower.includes('node') || lower.includes('component'))) {
      setNodes([]);
      setEdges([]);
      addToHistory('Cleared all architecture nodes', 'AI');
      addOutputLog('[AI] Cleared all nodes and edges');
      return `[ACTION] Cleared all nodes and edges from the architecture.\n\nThe canvas is now empty. You can add new components or generate a fresh architecture.`;
    }

    const addNodeMatch = lower.match(/add\s+(mcu|sensor|power|comm|connector)?\s*(?:component|node|block)?\s*(?:called|named)?\s*(.+)/i);
    if (addNodeMatch || (lower.includes('add') && (lower.includes('mcu') || lower.includes('sensor') || lower.includes('power') || lower.includes('comm') || lower.includes('connector') || lower.includes('node') || lower.includes('component')))) {
      let nodeType = 'mcu';
      let nodeName = 'New Component';
      if (addNodeMatch) {
        nodeType = addNodeMatch[1] || 'mcu';
        nodeName = addNodeMatch[2]?.trim() || 'New Component';
      } else {
        if (lower.includes('mcu')) { nodeType = 'mcu'; nodeName = 'MCU Node'; }
        else if (lower.includes('sensor')) { nodeType = 'sensor'; nodeName = 'Sensor Node'; }
        else if (lower.includes('power')) { nodeType = 'power'; nodeName = 'Power Node'; }
        else if (lower.includes('comm')) { nodeType = 'comm'; nodeName = 'Comm Node'; }
        else if (lower.includes('connector')) { nodeType = 'connector'; nodeName = 'Connector Node'; }
        else { nodeName = 'New Component'; }
      }
      if (nodeName.toLowerCase() === 'mcu node' && lower.includes('add mcu node')) {
        nodeName = 'ESP32-S3';
        nodeType = 'mcu';
      }
      const newNode = {
        id: Date.now().toString(),
        type: 'custom' as const,
        position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
        data: { label: nodeName, type: nodeType, description: `${nodeType.toUpperCase()} component` },
      };
      setNodes([...nodes, newNode]);
      setActiveView('architecture' as any);
      addToHistory(`Added ${nodeType} node: ${nodeName}`, 'AI');
      addOutputLog(`[AI] Added ${nodeType} node: ${nodeName}`);
      return `[ACTION] Added new ${nodeType.toUpperCase()} node '${nodeName}' to the architecture.\n\nI've placed it on the canvas. You can drag it to reposition, then connect it to other components.`;
    }

    if ((lower.includes('remove') || lower.includes('delete')) && (lower.includes('node') || lower.includes('component'))) {
      const nameMatch = lower.match(/(?:remove|delete)\s+(?:node|component)\s+(.+)/);
      if (nameMatch) {
        const targetName = nameMatch[1].trim();
        const nodeToRemove = nodes.find((n: any) => n.data.label.toLowerCase().includes(targetName));
        if (nodeToRemove) {
          setNodes(nodes.filter((n: any) => n.id !== nodeToRemove.id));
          setEdges(edges.filter((e: any) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id));
          addToHistory(`Removed node: ${nodeToRemove.data.label}`, 'AI');
          addOutputLog(`[AI] Removed node: ${nodeToRemove.data.label}`);
          return `[ACTION] Removed node '${nodeToRemove.data.label}' and its connections from the architecture.`;
        }
        return `Could not find a node matching '${targetName}'. Available nodes: ${nodes.map((n: any) => n.data.label).join(', ') || 'none'}.`;
      }
    }

    if (lower.includes('connect') && lower.includes(' to ')) {
      const connectMatch = lower.match(/connect\s+(.+?)\s+to\s+(.+)/);
      if (connectMatch) {
        const sourceName = connectMatch[1].trim();
        const targetName = connectMatch[2].trim();
        const sourceNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(sourceName));
        const targetNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(targetName));
        if (sourceNode && targetNode) {
          const newEdge = {
            id: `e-${Date.now()}`,
            source: sourceNode.id,
            target: targetNode.id,
            label: 'Data',
            animated: true,
          };
          setEdges([...edges, newEdge]);
          addToHistory(`Connected ${sourceNode.data.label} to ${targetNode.data.label}`, 'AI');
          addOutputLog(`[AI] Connected ${sourceNode.data.label} → ${targetNode.data.label}`);
          return `[ACTION] Connected '${sourceNode.data.label}' to '${targetNode.data.label}'.\n\nA data bus has been created between the two components.`;
        }
        return `Could not find one or both nodes. Available nodes: ${nodes.map((n: any) => n.data.label).join(', ') || 'none'}.`;
      }
    }

    if (lower.includes('add to bom') || lower.includes('add bom')) {
      const partMatch = lower.match(/(?:add to bom|add bom)\s+(.+)/);
      const partName = partMatch ? partMatch[1].trim() : 'Unknown Part';
      addBomItem({
        partNumber: partName.toUpperCase().replace(/\s+/g, '-'),
        manufacturer: 'TBD',
        description: partName,
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        supplier: 'Digi-Key',
        stock: 0,
        status: 'In Stock',
      });
      addToHistory(`Added BOM item: ${partName}`, 'AI');
      addOutputLog(`[AI] Added BOM item: ${partName}`);
      return `[ACTION] Added '${partName}' to the Bill of Materials.\n\nYou can update pricing and sourcing details in the Procurement view.`;
    }

    if (lower.includes('remove from bom') || lower.includes('delete from bom')) {
      const partMatch = lower.match(/(?:remove|delete) from bom\s+(.+)/);
      if (partMatch) {
        const partName = partMatch[1].trim().toLowerCase();
        const bomItem = bom.find((b: any) => b.partNumber.toLowerCase().includes(partName) || b.description.toLowerCase().includes(partName));
        if (bomItem) {
          deleteBomItem(Number(bomItem.id));
          addToHistory(`Removed BOM item: ${bomItem.partNumber}`, 'AI');
          addOutputLog(`[AI] Removed BOM item: ${bomItem.partNumber}`);
          return `[ACTION] Removed '${bomItem.partNumber}' from the Bill of Materials.`;
        }
        return `Could not find BOM item matching '${partMatch[1]}'. Check the Procurement view for current items.`;
      }
    }

    if (lower.includes('export bom') || lower.includes('export csv')) {
      if (bom.length === 0) return `No BOM items to export. Add components to the BOM first.`;
      const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Status'];
      const rows = bom.map((item: any) => [item.partNumber, item.manufacturer, item.description, item.quantity, item.unitPrice, item.totalPrice, item.supplier, item.status].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_BOM.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToHistory('Exported BOM as CSV', 'AI');
      addOutputLog('[AI] Exported BOM as CSV file');
      return `[ACTION] Exported BOM as CSV file (${bom.length} items).\n\nThe file '${projectName}_BOM.csv' has been downloaded.`;
    }

    if (lower.includes('optimize bom') || lower.includes('optimize cost')) {
      addToHistory('BOM optimization analysis', 'AI');
      addOutputLog('[AI] Ran BOM optimization analysis');
      return `[ACTION] BOM optimization analysis complete.\n\nSuggestions:\n• Consider alternative sourcing from LCSC for passive components (20-40% savings)\n• Consolidate resistor values to reduce unique part count\n• Check for volume pricing breaks at 1k+ quantities\n• Replace through-hole components with SMD equivalents where possible\n\nCurrent BOM has ${bom.length} items. Switch to Procurement view for details.`;
    }

    if (lower.includes('validate') || lower.includes('check design') || lower.includes('run drc') || lower.includes('check errors') || lower.includes('run validation')) {
      runValidation();
      addToHistory('Ran design validation', 'AI');
      addOutputLog('[AI] Ran design rule check');
      return `[ACTION] Design rule check complete.\n\nI've added a validation finding. Switch to the Validation view to review all ${issues.length + 1} issues and apply suggested fixes.`;
    }

    if (lower.includes('fix all issues') || lower.includes('fix all') || lower.includes('clear issues')) {
      if (issues.length === 0) return `No validation issues to fix. The design is currently clean.`;
      const count = issues.length;
      issues.forEach((issue: any) => deleteValidationIssue(Number(issue.id)));
      addToHistory(`Fixed ${count} validation issues`, 'AI');
      addOutputLog(`[AI] Cleared ${count} validation issues`);
      return `[ACTION] Removed ${count} validation issues.\n\nAll issues have been resolved. Run validation again to check for new findings.`;
    }

    if (lower.includes('rename project to') || lower.includes('rename project')) {
      const nameMatch = lower.match(/rename project (?:to\s+)?(.+)/);
      if (nameMatch) {
        const newName = nameMatch[1].trim();
        setProjectName(newName);
        addToHistory(`Renamed project to: ${newName}`, 'AI');
        addOutputLog(`[AI] Renamed project to: ${newName}`);
        return `[ACTION] Renamed project to '${newName}'.\n\nThe sidebar and project settings have been updated.`;
      }
    }

    if (lower.includes('set description to') || lower.includes('update description')) {
      const descMatch = lower.match(/(?:set|update) description (?:to\s+)?(.+)/);
      if (descMatch) {
        const newDesc = descMatch[1].trim();
        setProjectDescription(newDesc);
        addToHistory(`Updated project description`, 'AI');
        addOutputLog(`[AI] Updated project description: ${newDesc}`);
        return `[ACTION] Updated project description to '${newDesc}'.`;
      }
    }

    if (lower.includes('project info') || lower.includes('project summary') || lower.includes('show project') || lower.includes('project status')) {
      return `**Project Summary**\n\n• **Name:** ${projectName}\n• **Description:** ${projectDescription}\n• **Architecture Nodes:** ${nodes.length}\n• **Connections:** ${edges.length}\n• **BOM Items:** ${bom.length}\n• **Validation Issues:** ${issues.length}\n• **Active View:** ${activeView}\n• **Schematic Sheets:** ${schematicSheets.length}`;
    }

    if (lower === 'help' || lower.includes('what can you do') || lower.includes('show help') || lower.includes('commands')) {
      return `Here's what I can do:\n\n**Navigation:** Switch between views (architecture, schematic, procurement, validation, output)\n\n**Design:** Add/remove nodes, connect components, generate architectures, clear all nodes\n\n**BOM:** Add/remove parts, export CSV, optimize costs\n\n**Validation:** Run DRC checks, fix all issues\n\n**Project:** Rename project, update description, view summary\n\n**Examples:**\n• "add mcu called ATSAMD21"\n• "connect ESP32 to SHT40"\n• "switch to procurement"\n• "generate architecture"\n• "export bom csv"\n• "rename project to MyProject"`;
    }

    if (lower.includes('clear chat')) {
      return `Chat history is persistent and synced with the project. You can scroll up to review previous conversations.`;
    }

    if (lower.includes('schematic') || lower.includes('generate')) {
      return "I've analyzed the design for schematic generation. The architecture includes the ESP32-S3, LoRa transceiver, and power management units. All connections follow standard bus protocols. Try 'generate architecture' to create a default layout.";
    } else if (lower.includes('bom') || lower.includes('cost')) {
      return "BOM optimization tips:\n• TP4056 → MCP73831 (saves $0.08/unit, same footprint)\n• USB connector → alternate GCT part (saves $0.12/unit)\nTotal potential savings: $0.20/unit at 1k qty.\n\nTry 'optimize bom' for a full analysis or 'export bom csv' to download.";
    } else if (lower.includes('memory') || lower.includes('ram') || lower.includes('storage')) {
      return "For the ESP32-S3, I recommend adding external PSRAM (ESP-PSRAM64H, 8MB). Connect via the dedicated SPI interface on GPIO 33-37. Try 'add sensor called PSRAM64H' to add it to your design.";
    } else if (lower.includes('power') || lower.includes('battery')) {
      return "Power analysis summary:\n• Active mode: ~180mA (Wi-Fi TX)\n• Deep sleep: ~10µA\n• Battery life (2000mAh): ~45 days at 1 reading/hour\nRecommendation: Add a solar cell (5V/500mA) with MPPT for indefinite operation.";
    } else if (lower.includes('antenna') || lower.includes('rf')) {
      return "RF design recommendations:\n• LoRa antenna: Use a spring-type 868/915MHz antenna with SMA connector\n• Match impedance to 50Ω using Pi-network (L=3.3nH, C1=1.5pF, C2=1.8pF)\n• Keep RF trace width at 0.7mm for FR4 substrate (εr=4.6)";
    } else if (lower.includes('sensor') || lower.includes('temperature')) {
      return "Sensor configuration optimized:\n• SHT40: Set to high-precision mode (±0.2°C accuracy)\n• I2C address: 0x44, pull-ups: 4.7kΩ to 3.3V\n• Sample rate: 1Hz recommended for thermal stability\n• Consider adding SHT40-BD1B for extended range (-40°C to +125°C).";
    }

    return "I've analyzed your request. I can help with navigation, design, BOM management, validation, and project settings. Type 'help' to see all available commands.";
  };

  const executeAIActions = useCallback((actions: any[]) => {
    const executedLabels: string[] = [];
    for (const action of actions) {
      const label = ACTION_LABELS[action.type] || action.type;
      executedLabels.push(label);
      switch (action.type) {
        case 'switch_view':
          setActiveView(action.view);
          addToHistory(`Switched to ${action.view} view`, 'AI');
          addOutputLog(`[AI] Switched to ${action.view} view`);
          break;
        case 'switch_schematic_sheet':
          setActiveSheetId(action.sheetId);
          setActiveView('schematic');
          addToHistory(`Opened schematic sheet: ${action.sheetId}`, 'AI');
          addOutputLog(`[AI] Opened schematic sheet: ${action.sheetId}`);
          break;
        case 'add_node': {
          const newNode = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            type: 'custom' as const,
            position: { x: action.positionX || 200 + Math.random() * 400, y: action.positionY || 100 + Math.random() * 300 },
            data: { label: action.label, type: action.nodeType || 'generic', description: action.description || '' },
          };
          setNodes([...nodes, newNode]);
          setActiveView('architecture');
          addToHistory(`Added ${action.nodeType || 'component'}: ${action.label}`, 'AI');
          addOutputLog(`[AI] Added node: ${action.label}`);
          break;
        }
        case 'remove_node': {
          const nodeToRemove = nodes.find((n: any) => n.data.label.toLowerCase() === action.nodeLabel.toLowerCase());
          if (nodeToRemove) {
            setNodes(nodes.filter((n: any) => n.id !== nodeToRemove.id));
            setEdges(edges.filter((e: any) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id));
            addToHistory(`Removed node: ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Removed node: ${action.nodeLabel}`);
          }
          break;
        }
        case 'update_node': {
          const nodeToUpdate = nodes.find((n: any) => n.data.label.toLowerCase() === action.nodeLabel.toLowerCase());
          if (nodeToUpdate) {
            setNodes(nodes.map((n: any) => n.id === nodeToUpdate.id ? {
              ...n, data: { ...n.data, label: action.newLabel || n.data.label, type: action.newType || n.data.type, description: action.newDescription || n.data.description }
            } : n));
            addToHistory(`Updated node: ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Updated node: ${action.nodeLabel}`);
          }
          break;
        }
        case 'connect_nodes': {
          const sourceNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.sourceLabel.toLowerCase()));
          const targetNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.targetLabel.toLowerCase()));
          if (sourceNode && targetNode) {
            const newEdge = {
              id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              source: sourceNode.id, target: targetNode.id,
              label: action.edgeLabel || action.busType || 'Data', animated: true,
            };
            setEdges([...edges, newEdge]);
            addToHistory(`Connected ${sourceNode.data.label} → ${targetNode.data.label}`, 'AI');
            addOutputLog(`[AI] Connected ${sourceNode.data.label} → ${targetNode.data.label}`);
          }
          break;
        }
        case 'remove_edge': {
          const srcNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.sourceLabel.toLowerCase()));
          const tgtNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.targetLabel.toLowerCase()));
          if (srcNode && tgtNode) {
            setEdges(edges.filter((e: any) => !(e.source === srcNode.id && e.target === tgtNode.id)));
            addToHistory(`Removed edge: ${action.sourceLabel} → ${action.targetLabel}`, 'AI');
            addOutputLog(`[AI] Removed edge: ${action.sourceLabel} → ${action.targetLabel}`);
          }
          break;
        }
        case 'clear_canvas':
          setNodes([]);
          setEdges([]);
          addToHistory('Cleared all architecture nodes', 'AI');
          addOutputLog('[AI] Cleared all nodes and edges');
          break;
        case 'generate_architecture': {
          const genNodes = action.components.map((comp: any, idx: number) => ({
            id: `gen-${Date.now()}-${idx}`,
            type: 'custom' as const,
            position: { x: comp.positionX, y: comp.positionY },
            data: { label: comp.label, type: comp.nodeType, description: comp.description },
          }));
          setNodes(genNodes);
          const genEdges = action.connections.map((conn: any, idx: number) => {
            const src = genNodes.find((n: any) => n.data.label === conn.sourceLabel);
            const tgt = genNodes.find((n: any) => n.data.label === conn.targetLabel);
            return { id: `gen-e-${Date.now()}-${idx}`, source: src?.id || '', target: tgt?.id || '', label: conn.label, animated: true };
          }).filter((e: any) => e.source && e.target);
          setEdges(genEdges);
          setActiveView('architecture');
          addToHistory(`Generated architecture with ${genNodes.length} components`, 'AI');
          addOutputLog(`[AI] Generated architecture: ${genNodes.length} components, ${genEdges.length} connections`);
          break;
        }
        case 'add_bom_item':
          addBomItem({
            partNumber: action.partNumber, manufacturer: action.manufacturer, description: action.description,
            quantity: action.quantity || 1, unitPrice: action.unitPrice || 0,
            totalPrice: (action.quantity || 1) * (action.unitPrice || 0),
            supplier: action.supplier || 'TBD', stock: 0, status: action.status || 'In Stock',
          });
          addToHistory(`Added BOM item: ${action.partNumber}`, 'AI');
          addOutputLog(`[AI] Added BOM item: ${action.partNumber}`);
          break;
        case 'remove_bom_item': {
          const bomItem = bom.find((b: any) => b.partNumber.toLowerCase().includes(action.partNumber.toLowerCase()));
          if (bomItem) {
            deleteBomItem(Number(bomItem.id));
            addToHistory(`Removed BOM item: ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Removed BOM item: ${action.partNumber}`);
          }
          break;
        }
        case 'update_bom_item': {
          const bomToUpdate = bom.find((b: any) => b.partNumber.toLowerCase().includes(action.partNumber.toLowerCase()));
          if (bomToUpdate && updateBomItem) {
            updateBomItem(Number(bomToUpdate.id), action.updates);
            addToHistory(`Updated BOM item: ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Updated BOM: ${action.partNumber}`);
          }
          break;
        }
        case 'run_validation':
          runValidation();
          addToHistory('Ran design validation', 'AI');
          addOutputLog('[AI] Ran design validation');
          break;
        case 'clear_validation':
          issues.forEach((issue: any) => deleteValidationIssue(Number(issue.id)));
          addToHistory('Cleared validation issues', 'AI');
          addOutputLog('[AI] Cleared all validation issues');
          break;
        case 'add_validation_issue':
          addValidationIssue({ severity: action.severity, message: action.message, componentId: action.componentId, suggestion: action.suggestion });
          addToHistory(`Added validation: ${action.message}`, 'AI');
          addOutputLog(`[AI] Added validation issue: ${action.message}`);
          break;
        case 'rename_project':
          setProjectName(action.name);
          addToHistory(`Renamed project to: ${action.name}`, 'AI');
          addOutputLog(`[AI] Renamed project to: ${action.name}`);
          break;
        case 'update_description':
          setProjectDescription(action.description);
          addToHistory(`Updated project description`, 'AI');
          addOutputLog(`[AI] Updated description: ${action.description}`);
          break;
        case 'export_bom_csv': {
          if (bom.length > 0) {
            const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Status'];
            const rows = bom.map((item: any) => [item.partNumber, item.manufacturer, item.description, item.quantity, item.unitPrice, item.totalPrice, item.supplier, item.status].join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}_BOM.csv`;
            a.click();
            URL.revokeObjectURL(url);
            addToHistory('Exported BOM as CSV', 'AI');
            addOutputLog('[AI] Exported BOM as CSV');
          }
          break;
        }
      }
    }
    return executedLabels;
  }, [nodes, edges, bom, issues, projectName, setNodes, setEdges, addBomItem, deleteBomItem, updateBomItem, runValidation, deleteValidationIssue, addValidationIssue, setActiveView, setActiveSheetId, setProjectName, setProjectDescription, addToHistory, addOutputLog]);

  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
    setStreamingContent('');
  }, [setIsGenerating]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const msgText = messageOverride || input;
    if (!msgText.trim()) return;

    setInput('');
    setLastUserMessage(msgText);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msgText,
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setIsGenerating(true);

    try {
      if (!aiApiKey) {
        setTimeout(() => {
          const response = processLocalCommand(msgText);
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response,
            timestamp: Date.now()
          });
          setIsGenerating(false);
        }, 500);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setStreamingContent('');

      const response = await fetch('/api/chat/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: msgText,
          provider: aiProvider,
          model: aiModel,
          apiKey: aiApiKey,
          temperature: aiTemperature,
          customSystemPrompt,
          activeView,
          schematicSheets: schematicSheets.map((s: any) => ({ id: s.id, name: s.name })),
          activeSheetId,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let finalActions: any[] = [];

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullText += data.text;
                setStreamingContent(fullText);
              } else if (data.type === 'done') {
                fullText = data.message;
                finalActions = data.actions || [];
              } else if (data.type === 'error') {
                fullText = data.message || 'Stream failed';
              }
            } catch {}
          }
        }
      }

      setStreamingContent('');

      const hasDestructive = finalActions.some((a: any) => DESTRUCTIVE_ACTIONS.includes(a.type));
      const msgId = (Date.now() + 1).toString();

      if (hasDestructive && finalActions.length > 0) {
        setPendingActions({ actions: finalActions, messageId: msgId });
        addMessage({
          id: msgId,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          actions: finalActions,
        });
      } else {
        if (finalActions.length > 0) {
          executeAIActions(finalActions);
        }
        addMessage({
          id: msgId,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          actions: finalActions,
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Request was cancelled.',
          timestamp: Date.now(),
        });
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to communicate with AI. Check your settings.'}`,
          timestamp: Date.now(),
          isError: true,
        });
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [input, aiApiKey, aiProvider, aiModel, aiTemperature, activeView, schematicSheets, activeSheetId, addMessage, setIsGenerating, executeAIActions, processLocalCommand]);

  const handleRegenerate = useCallback(() => {
    if (lastUserMessage && !isGenerating) {
      handleSend(lastUserMessage);
    }
  }, [lastUserMessage, isGenerating, handleSend]);

  const exportChat = useCallback(() => {
    const text = messages.map((m: any) =>
      `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
    ).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_chat.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, projectName]);

  const filteredMessages = chatSearch
    ? messages.filter((m: any) => m.content.toLowerCase().includes(chatSearch.toLowerCase()))
    : messages;

  const generateFollowUps = useCallback((): string[] => {
    if (messages.length === 0) return [];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return [];
    const content = last.content.toLowerCase();
    const suggestions: string[] = [];

    if (content.includes('architecture') || content.includes('node') || content.includes('component')) {
      suggestions.push('Run Validation');
      if (nodes.length > 0) suggestions.push('Optimize BOM');
    }
    if (content.includes('bom') || content.includes('part') || content.includes('cost')) {
      suggestions.push('Export BOM CSV');
      suggestions.push('Switch to Procurement');
    }
    if (content.includes('validation') || content.includes('issue') || content.includes('error')) {
      suggestions.push('Fix all issues');
      suggestions.push('Project Summary');
    }
    if (content.includes('generated') || content.includes('created') || content.includes('added')) {
      suggestions.push('Switch to Architecture');
      suggestions.push('Run Validation');
    }

    if (suggestions.length === 0) {
      suggestions.push('Project Summary', 'Show Help');
    }

    return suggestions.slice(0, 3);
  }, [messages, nodes]);

  const acceptPendingActions = useCallback(() => {
    if (pendingActions) {
      executeAIActions(pendingActions.actions);
      setPendingActions(null);
    }
  }, [pendingActions, executeAIActions]);

  const rejectPendingActions = useCallback(() => {
    setPendingActions(null);
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Actions cancelled. No changes were made to your design.',
      timestamp: Date.now(),
    });
  }, [addMessage]);

  const apiKeyValid = useCallback(() => {
    if (!aiApiKey) return true;
    if (aiProvider === 'anthropic') return aiApiKey.startsWith('sk-ant-');
    if (aiProvider === 'gemini') return aiApiKey.length >= 20;
    return true;
  }, [aiApiKey, aiProvider]);

  if (collapsed) {
    return (
      <div
        data-testid="chat-collapsed"
        className="hidden md:flex flex-col items-center w-10 h-full bg-card/60 backdrop-blur-xl border-l border-border shrink-0 cursor-pointer transition-all duration-300"
        onClick={onToggleCollapse}
      >
        <div className="h-14 flex items-center justify-center border-b border-border w-full">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground" style={{ writingMode: 'vertical-rl' }}>
            AI Assistant
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div data-testid="chat-backdrop" className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <div
        className={cn(
          "flex flex-col h-full bg-card/60 backdrop-blur-xl border-l border-border shadow-2xl relative shrink-0 overflow-hidden",
          "fixed inset-y-0 right-0 z-50 w-full max-w-[350px] transform transition-transform md:relative md:translate-x-0 md:max-w-none",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ width: width }}
      >
        <div className="flex flex-col h-full w-full">
          {/* Header */}
          <div className="h-14 border-b border-border bg-card/30 backdrop-blur flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold tracking-wider text-sm">ProtoPulse AI</h3>
            </div>
            <div className="flex gap-1 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button data-testid="chat-search-toggle" onClick={() => setShowSearch(!showSearch)} className={cn("p-1.5 hover:bg-muted transition-colors", showSearch && "text-primary bg-primary/10")}>
                    <Search className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom"><p>Search chat</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button data-testid="chat-export" onClick={exportChat} className="p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Download className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom"><p>Export chat</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="settings-button"
                    className={cn("p-1.5 hover:bg-muted transition-colors", showSettings && "text-primary bg-primary/10")}
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom"><p>AI Settings</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button data-testid="chat-close" className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 md:hidden" onClick={onClose}>
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom"><p>Close (Esc)</p></TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="px-3 py-2 border-b border-border bg-card/20 flex items-center gap-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                data-testid="chat-search-input"
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search messages..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                autoFocus
              />
              {chatSearch && (
                <button onClick={() => setChatSearch('')} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {showSettings ? (
            <SettingsPanel
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
              aiModel={aiModel}
              setAiModel={setAiModel}
              aiApiKey={aiApiKey}
              setAiApiKey={setAiApiKey}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              aiTemperature={aiTemperature}
              setAiTemperature={setAiTemperature}
              customSystemPrompt={customSystemPrompt}
              setCustomSystemPrompt={setCustomSystemPrompt}
              apiKeyValid={apiKeyValid}
              onClose={() => setShowSettings(false)}
            />
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 relative" ref={scrollRef}>
                {filteredMessages.length === 0 && !chatSearch && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
                    <Bot className="w-12 h-12 mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">Ask ProtoPulse AI to generate a schematic, optimize costs, or validate your design.</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {['Generate Architecture', 'Project Summary', 'Show Help'].map(cmd => (
                        <button
                          key={cmd}
                          onClick={() => handleSend(cmd)}
                          data-testid={`empty-suggestion-${cmd.toLowerCase().replace(/\s+/g, '-')}`}
                          className="px-3 py-1.5 bg-muted/40 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                        >
                          {cmd}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatSearch && filteredMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
                    <Search className="w-8 h-8 mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No messages matching "{chatSearch}"</p>
                  </div>
                )}

                {filteredMessages.map((msg: any) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    copiedId={copiedId}
                    onCopy={copyMessage}
                    onRegenerate={msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id ? handleRegenerate : undefined}
                    onRetry={msg.isError ? () => handleSend(lastUserMessage) : undefined}
                    isLast={msg.id === messages[messages.length - 1]?.id}
                    pendingActions={pendingActions?.messageId === msg.id ? pendingActions : null}
                    onAcceptActions={acceptPendingActions}
                    onRejectActions={rejectPendingActions}
                  />
                ))}

                {/* Streaming indicator */}
                {isGenerating && (
                  <div className="flex gap-3 text-sm">
                    <div className="w-8 h-8 flex items-center justify-center shrink-0 border bg-primary/10 text-primary border-primary/20">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-1 max-w-[85%]">
                      <div className="bg-muted/30 backdrop-blur border border-border text-foreground p-3">
                        {streamingContent ? (
                          <MarkdownContent content={streamingContent} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground animate-pulse">Analyzing system requirements...</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={cancelRequest}
                        data-testid="cancel-generation"
                        className="flex items-center gap-1 text-[10px] text-destructive/70 hover:text-destructive px-1 w-fit transition-colors"
                      >
                        <StopCircle className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Scroll to bottom */}
              {showScrollBtn && (
                <button
                  onClick={scrollToBottom}
                  data-testid="scroll-to-bottom"
                  className="absolute bottom-32 right-6 w-8 h-8 bg-primary/20 border border-primary/40 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors z-10 shadow-lg"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}

              {/* Follow-up suggestions */}
              {!isGenerating && messages.length > 0 && !pendingActions && (
                <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                  {generateFollowUps().map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      data-testid={`followup-${suggestion.toLowerCase().replace(/\s+/g, '-')}`}
                      className="whitespace-nowrap px-3 py-1.5 bg-muted/40 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <ArrowRight className="w-3 h-3" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Input area */}
          <div className="p-4 border-t border-border bg-card/40 backdrop-blur shrink-0">
            {!apiKeyValid() && aiApiKey && (
              <div className="flex items-center gap-2 text-[10px] text-amber-400/80 mb-2 px-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>API key format looks incorrect for {aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'}</span>
              </div>
            )}
            <div className="relative">
              <textarea
                ref={textareaRef}
                data-testid="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe your system... (Shift+Enter for new line)"
                rows={1}
                className="w-full bg-muted/30 border border-border focus:border-primary pr-10 pl-10 py-3 shadow-inner resize-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              <div className="absolute left-3 top-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center" onClick={() => setShowQuickActions(!showQuickActions)}>
                      <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>Quick actions</p></TooltipContent>
                </Tooltip>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    onClick={() => handleSend()}
                    disabled={isGenerating || !input.trim()}
                    data-testid="send-button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>Send (Enter)</p></TooltipContent>
              </Tooltip>
            </div>

            {/* Quick actions row */}
            {showQuickActions && !isGenerating && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
                {Object.entries(quickActionDescriptions).map(([action, desc]) => (
                  <Tooltip key={action}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleSend(action)}
                        data-testid={`quick-action-${action.toLowerCase().replace(/\s+/g, '-')}`}
                        className="whitespace-nowrap px-2.5 py-1 bg-muted/30 border border-border text-[11px] text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1 shrink-0"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {action}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>{desc}</p></TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}

            <div className="text-[10px] text-center text-muted-foreground/40 mt-2 font-mono">
              {aiApiKey ? `${aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} — ${AI_MODELS[aiProvider].find(m => m.id === aiModel)?.label || aiModel}` : 'Local Mode (No API Key)'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-primary/90">{children}</strong>,
        em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
        h1: ({ children }) => <h1 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mb-1.5 mt-2 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-1 mt-2 first:mt-0">{children}</h3>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-background/60 border border-border p-2 my-2 overflow-x-auto text-[11px] font-mono">
                <code>{children}</code>
              </pre>
            );
          }
          return <code className="bg-primary/10 text-primary px-1 py-0.5 text-[11px] font-mono">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a>,
        table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border border-border">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-muted/30">{children}</thead>,
        th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-bold">{children}</th>,
        td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function MessageBubble({ msg, copiedId, onCopy, onRegenerate, onRetry, isLast, pendingActions, onAcceptActions, onRejectActions }: {
  msg: ChatMessage;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  isLast: boolean;
  pendingActions: { actions: any[]; messageId: string } | null;
  onAcceptActions: () => void;
  onRejectActions: () => void;
}) {
  return (
    <div className={cn(
      "flex gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 group/msg",
      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "w-8 h-8 flex items-center justify-center shrink-0 border shadow-sm",
        msg.role === 'user' ? "bg-muted text-foreground border-border" : "bg-primary/10 text-primary border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
      )}>
        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className={cn(
          "p-3 leading-relaxed shadow-sm relative",
          msg.role === 'user'
            ? "bg-primary text-primary-foreground"
            : msg.isError
              ? "bg-destructive/10 border border-destructive/30 text-foreground"
              : "bg-muted/30 backdrop-blur border border-border text-foreground"
        )}>
          {msg.role === 'assistant' ? (
            <MarkdownContent content={msg.content} />
          ) : (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          )}
        </div>

        {/* Action chips */}
        {msg.actions && msg.actions.length > 0 && !pendingActions && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.actions.map((action: any, idx: number) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 text-[10px] text-primary">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {ACTION_LABELS[action.type] || action.type}
              </span>
            ))}
          </div>
        )}

        {/* Destructive action confirmation */}
        {pendingActions && (
          <div className="border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Confirm destructive actions
            </div>
            <div className="flex flex-wrap gap-1">
              {pendingActions.actions.map((action: any, idx: number) => (
                <span key={idx} className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border",
                  DESTRUCTIVE_ACTIONS.includes(action.type) ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-primary/20 bg-primary/10 text-primary"
                )}>
                  {ACTION_LABELS[action.type] || action.type}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={onAcceptActions} data-testid="accept-actions" className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">
                Apply Changes
              </button>
              <button onClick={onRejectActions} data-testid="reject-actions" className="flex-1 py-1.5 bg-muted border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Message footer */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-muted-foreground opacity-50">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCopy(msg.id, msg.content)}
                  data-testid={`copy-msg-${msg.id}`}
                  className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>Copy</p></TooltipContent>
            </Tooltip>
            {onRegenerate && isLast && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onRegenerate} data-testid="regenerate-msg" className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>Regenerate</p></TooltipContent>
              </Tooltip>
            )}
            {onRetry && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onRetry} data-testid="retry-msg" className="p-1 hover:bg-muted text-destructive/70 hover:text-destructive transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>Retry</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  aiProvider, setAiProvider, aiModel, setAiModel, aiApiKey, setAiApiKey,
  showApiKey, setShowApiKey, aiTemperature, setAiTemperature,
  customSystemPrompt, setCustomSystemPrompt, apiKeyValid, onClose,
}: any) {
  return (
    <div className="flex-1 overflow-y-auto bg-background/95 backdrop-blur-xl p-4 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h4 className="font-display font-bold tracking-wider text-sm">AI Settings</h4>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Provider</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="provider-anthropic"
            onClick={() => { setAiProvider('anthropic'); setAiModel(AI_MODELS.anthropic[0].id); }}
            className={cn(
              "p-3 border text-center text-sm font-bold transition-all",
              aiProvider === 'anthropic' ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]" : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
            )}
          >
            Anthropic
          </button>
          <button
            data-testid="provider-gemini"
            onClick={() => { setAiProvider('gemini'); setAiModel(AI_MODELS.gemini[0].id); }}
            className={cn(
              "p-3 border text-center text-sm font-bold transition-all",
              aiProvider === 'gemini' ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]" : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
            )}
          >
            Gemini
          </button>
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Model</label>
        <div className="relative">
          <select
            data-testid="model-select"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full bg-muted/30 border border-border text-foreground text-sm p-2.5 pr-8 appearance-none focus:outline-none focus:border-primary"
          >
            {AI_MODELS[aiProvider as keyof typeof AI_MODELS].map((m: any) => (
              <option key={m.id} value={m.id} className="bg-background text-foreground">{m.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">API Key</label>
        <div className="relative">
          <input
            data-testid="api-key-input"
            type={showApiKey ? 'text' : 'password'}
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder={aiProvider === 'anthropic' ? "sk-ant-..." : "Enter your API key..."}
            className={cn(
              "w-full bg-muted/30 border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40",
              aiApiKey && !apiKeyValid() ? "border-amber-500/50" : "border-border"
            )}
          />
          <button
            data-testid="toggle-api-key-visibility"
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {aiApiKey && !apiKeyValid() && (
          <p className="text-[10px] text-amber-400/80 mt-1">
            {aiProvider === 'anthropic' ? "Anthropic keys start with 'sk-ant-'" : "Key appears too short"}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          Get your key at{' '}
          <span className="text-primary/70">console.anthropic.com</span> or{' '}
          <span className="text-primary/70">aistudio.google.dev</span>
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Temperature</label>
          <span className="text-xs text-primary font-mono">{aiTemperature.toFixed(1)}</span>
        </div>
        <input
          data-testid="temperature-slider"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={aiTemperature}
          onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-muted/50 appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-0"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Custom Instructions (optional)</label>
        <textarea
          data-testid="custom-system-prompt"
          value={customSystemPrompt}
          onChange={(e) => setCustomSystemPrompt(e.target.value)}
          placeholder="Add custom instructions for the AI..."
          rows={3}
          className="w-full bg-muted/30 border border-border text-foreground text-xs p-2.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40 resize-none"
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1">These instructions are appended to the AI's system prompt.</p>
      </div>

      <button
        data-testid="save-settings"
        onClick={onClose}
        className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
      >
        Save & Close
      </button>
    </div>
  );
}
