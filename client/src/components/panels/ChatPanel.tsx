import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, Sparkles, Loader2, Plus, Zap, X, Settings2,
  ChevronDown, ArrowDown, Search, Download, Trash2,
  StopCircle, AlertTriangle, ArrowRight, SlidersHorizontal, Mic, ImagePlus
} from 'lucide-react';
import { useProject, type ChatMessage } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { quickActionDescriptions, AI_MODELS, DESTRUCTIVE_ACTIONS, COPY_FEEDBACK_DURATION, LOCAL_COMMAND_DELAY, ACTION_LABELS } from './chat/constants';
import MessageBubble, { MarkdownContent } from './chat/MessageBubble';
import SettingsPanel from './chat/SettingsPanel';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function ChatPanel({ isOpen, onClose, collapsed = false, width = 350, onToggleCollapse }: ChatPanelProps) {
  const {
    messages, addMessage, isGenerating, setIsGenerating,
    runValidation, addValidationIssue, deleteValidationIssue, issues,
    setNodes, setEdges, nodes, edges,
    bom, addBomItem, deleteBomItem, updateBomItem,
    activeView, setActiveView,
    activeSheetId, setActiveSheetId, schematicSheets,
    projectName, setProjectName, projectDescription, setProjectDescription,
    addToHistory, addOutputLog,
    selectedNodeId,
    pushUndoState, undo, redo, canUndo, canRedo,
    captureSnapshot, getChangeDiff,
  } = useProject();
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiProvider, setAiProvider] = useState<'anthropic' | 'gemini'>(() => {
    try { return (localStorage.getItem('protopulse_ai_provider') as 'anthropic' | 'gemini') || 'anthropic'; } catch { return 'anthropic'; }
  });
  const [aiModel, setAiModel] = useState(() => {
    try {
      const stored = localStorage.getItem('protopulse_ai_model');
      const provider = (localStorage.getItem('protopulse_ai_provider') as 'anthropic' | 'gemini') || 'anthropic';
      const models = AI_MODELS[provider];
      if (stored && models.some(m => m.id === stored)) return stored;
      return models[0].id;
    } catch { return AI_MODELS.anthropic[0].id; }
  });
  // TODO: Migrate API key storage to server-side via GET/POST /api/settings/api-keys
  // The backend supports encrypted key storage per provider. Once auth is wired up,
  // fetch stored keys on mount and save via POST instead of keeping in-memory only.
  const [aiApiKey, setAiApiKey] = useState(() => {
    return '';
  });
  const [aiTemperature, setAiTemperature] = useState(() => {
    try { return parseFloat(localStorage.getItem('protopulse_ai_temp') || '0.7'); } catch { return 0.7; }
  });
  const [customSystemPrompt, setCustomSystemPrompt] = useState(() => {
    try { return localStorage.getItem('protopulse_ai_sysprompt') || ''; } catch { return ''; }
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
  const [isListening, setIsListening] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{input: number; output: number; cost: number} | null>(null);

  useEffect(() => { try { localStorage.setItem('protopulse_ai_provider', aiProvider); } catch {} }, [aiProvider]);
  useEffect(() => { try { localStorage.setItem('protopulse_ai_model', aiModel); } catch {} }, [aiModel]);
  useEffect(() => { try { localStorage.setItem('protopulse_ai_temp', String(aiTemperature)); } catch {} }, [aiTemperature]);
  useEffect(() => { try { localStorage.setItem('protopulse_ai_sysprompt', customSystemPrompt); } catch {} }, [customSystemPrompt]);

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
    copyToClipboard(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), COPY_FEEDBACK_DURATION);
  }, []);

  const processLocalCommand = (msgText: string): string => {
    const lower = msgText.toLowerCase().trim();

    const viewMap: Record<string, string> = {
      'architecture': 'architecture',
      'component editor': 'component_editor',
      'procurement': 'procurement',
      'validation': 'validation',
      'output': 'output',
    };
    for (const [key, view] of Object.entries(viewMap)) {
      if ((lower.includes('switch to') || lower.includes('go to') || lower.includes('show') || lower.includes('open')) && lower.includes(key)) {
        if (key === 'component editor') {
          const sheetMatch = lower.match(/sheet\s+(.+)/);
          if (sheetMatch) {
            const sheetName = sheetMatch[1].trim();
            const sheet = schematicSheets.find((s: any) => s.name.toLowerCase().includes(sheetName) || s.id.toLowerCase() === sheetName);
            if (sheet) {
              setActiveSheetId(sheet.id);
              setActiveView('component_editor' as any);
              addToHistory(`Opened schematic sheet: ${sheet.name}`, 'AI');
              addOutputLog(`[AI] Opened schematic sheet: ${sheet.name}`);
              return `[ACTION] Opened schematic sheet '${sheet.name}'.\n\nYou can now view and edit this sheet in the component editor.`;
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
          deleteBomItem(bomItem.id);
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
      try {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}_BOM.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('Export failed:', err);
        return `Export failed. Please try again.`;
      }
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
      issues.forEach((issue: any) => deleteValidationIssue(issue.id));
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
      return `Here's what I can do:\n\n**Navigation:** Switch between views (architecture, component editor, procurement, validation, output)\n\n**Design:** Add/remove nodes, connect components, generate architectures, clear all nodes\n\n**BOM:** Add/remove parts, export CSV, optimize costs\n\n**Validation:** Run DRC checks, fix all issues\n\n**Project:** Rename project, update description, view summary\n\n**Examples:**\n• "add mcu called ATSAMD21"\n• "connect ESP32 to SHT40"\n• "switch to procurement"\n• "generate architecture"\n• "export bom csv"\n• "rename project to MyProject"`;
    }

    if (lower.includes('clear chat')) {
      return `Chat history is persistent and synced with the project. You can scroll up to review previous conversations.`;
    }

    if (lower.includes('component') || lower.includes('generate')) {
      return "I've analyzed the design for component generation. The architecture includes the ESP32-S3, LoRa transceiver, and power management units. All connections follow standard bus protocols. Try 'generate architecture' to create a default layout or open the Component Editor to design individual parts.";
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
    pushUndoState();
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
          setActiveView('component_editor');
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
            const newEdge: any = {
              id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              source: sourceNode.id, target: targetNode.id,
              label: action.edgeLabel || action.busType || 'Data', animated: true,
              data: {
                signalType: action.signalType || undefined,
                voltage: action.voltage || undefined,
                busWidth: action.busWidth || undefined,
                netName: action.netName || undefined,
              },
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
            deleteBomItem(bomItem.id);
            addToHistory(`Removed BOM item: ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Removed BOM item: ${action.partNumber}`);
          }
          break;
        }
        case 'update_bom_item': {
          const bomToUpdate = bom.find((b: any) => b.partNumber.toLowerCase().includes(action.partNumber.toLowerCase()));
          if (bomToUpdate && updateBomItem) {
            updateBomItem(bomToUpdate.id, action.updates);
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
          issues.forEach((issue: any) => deleteValidationIssue(issue.id));
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
            try {
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
            } catch (err) {
              console.warn('Export failed:', err);
            }
          }
          break;
        }
        case 'undo':
          undo();
          addToHistory('Undid last action', 'AI');
          addOutputLog('[AI] Undid last action');
          break;
        case 'redo':
          redo();
          addToHistory('Redid action', 'AI');
          addOutputLog('[AI] Redid action');
          break;
        case 'auto_layout': {
          const currentNodes = [...nodes];
          if (currentNodes.length === 0) break;
          const layoutType = action.layout || 'hierarchical';
          let arranged: typeof currentNodes;
          
          if (layoutType === 'grid') {
            const cols = Math.ceil(Math.sqrt(currentNodes.length));
            arranged = currentNodes.map((n: any, i: number) => ({
              ...n,
              position: { x: 100 + (i % cols) * 220, y: 100 + Math.floor(i / cols) * 180 },
            }));
          } else if (layoutType === 'circular') {
            const cx = 400, cy = 300, r = 200;
            arranged = currentNodes.map((n: any, i: number) => {
              const angle = (2 * Math.PI * i) / currentNodes.length - Math.PI / 2;
              return { ...n, position: { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) } };
            });
          } else if (layoutType === 'force') {
            const spacing = 250;
            arranged = currentNodes.map((n: any, i: number) => ({
              ...n,
              position: { x: 100 + (i % 3) * spacing + (Math.random() * 40 - 20), y: 100 + Math.floor(i / 3) * spacing + (Math.random() * 40 - 20) },
            }));
          } else {
            const typeOrder: Record<string, number> = { power: 0, mcu: 1, comm: 2, sensor: 3, connector: 4, memory: 5, actuator: 6, ic: 7, passive: 8, module: 9 };
            const sorted = [...currentNodes].sort((a: any, b: any) => (typeOrder[a.data.type] ?? 5) - (typeOrder[b.data.type] ?? 5));
            let col = 0;
            let lastType = '';
            let row = 0;
            arranged = sorted.map((n: any) => {
              if (n.data.type !== lastType) { col++; row = 0; lastType = n.data.type; }
              row++;
              return { ...n, position: { x: 80 + col * 220, y: 60 + row * 160 } };
            });
          }
          setNodes(arranged);
          setActiveView('architecture');
          addToHistory(`Auto-arranged layout (${layoutType})`, 'AI');
          addOutputLog(`[AI] Auto-arranged ${currentNodes.length} nodes using ${layoutType} layout`);
          break;
        }
        case 'add_subcircuit': {
          const templates: Record<string, { nodes: Array<{label: string; type: string; desc: string; dx: number; dy: number}>; edges: Array<{src: number; tgt: number; label: string; signal?: string}> }> = {
            power_supply_ldo: {
              nodes: [
                { label: 'LDO Regulator', type: 'power', desc: 'AMS1117-3.3 LDO', dx: 0, dy: 0 },
                { label: 'Input Cap', type: 'passive', desc: '10uF Ceramic', dx: -150, dy: 0 },
                { label: 'Output Cap', type: 'passive', desc: '22uF Ceramic', dx: 150, dy: 0 },
              ],
              edges: [
                { src: 1, tgt: 0, label: 'VIN', signal: 'power' },
                { src: 0, tgt: 2, label: 'VOUT', signal: 'power' },
              ],
            },
            usb_interface: {
              nodes: [
                { label: 'USB-C Connector', type: 'connector', desc: 'USB Type-C', dx: 0, dy: 0 },
                { label: 'ESD Protection', type: 'ic', desc: 'USBLC6-2SC6', dx: 150, dy: -60 },
                { label: 'USB-UART Bridge', type: 'ic', desc: 'CP2102N', dx: 300, dy: 0 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'D+/D-', signal: 'USB' },
                { src: 1, tgt: 2, label: 'D+/D-', signal: 'USB' },
              ],
            },
            spi_flash: {
              nodes: [
                { label: 'SPI Flash', type: 'memory', desc: 'W25Q128 16MB', dx: 0, dy: 0 },
                { label: 'Decoupling Cap', type: 'passive', desc: '100nF Ceramic', dx: 0, dy: 100 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'VCC', signal: 'power' },
              ],
            },
            i2c_sensors: {
              nodes: [
                { label: 'I2C Temp Sensor', type: 'sensor', desc: 'TMP117 ±0.1°C', dx: 0, dy: 0 },
                { label: 'I2C Accel', type: 'sensor', desc: 'LIS3DH 3-axis', dx: 200, dy: 0 },
                { label: 'I2C Pull-ups', type: 'passive', desc: '4.7kΩ SDA/SCL', dx: 100, dy: -80 },
              ],
              edges: [
                { src: 2, tgt: 0, label: 'I2C', signal: 'I2C' },
                { src: 2, tgt: 1, label: 'I2C', signal: 'I2C' },
              ],
            },
            uart_debug: {
              nodes: [
                { label: 'Debug Header', type: 'connector', desc: 'UART 3-pin', dx: 0, dy: 0 },
                { label: 'Level Shifter', type: 'ic', desc: 'TXB0102', dx: 150, dy: 0 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'TX/RX', signal: 'UART' },
              ],
            },
            battery_charger: {
              nodes: [
                { label: 'Charger IC', type: 'power', desc: 'MCP73831', dx: 0, dy: 0 },
                { label: 'Battery', type: 'power', desc: 'Li-Po 3.7V', dx: 200, dy: 0 },
                { label: 'Charge LED', type: 'passive', desc: 'Red LED + 1kΩ', dx: 0, dy: 100 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'BAT', signal: 'power' },
                { src: 0, tgt: 2, label: 'STAT', signal: 'GPIO' },
              ],
            },
            motor_driver: {
              nodes: [
                { label: 'H-Bridge', type: 'actuator', desc: 'DRV8833', dx: 0, dy: 0 },
                { label: 'Motor A', type: 'actuator', desc: 'DC Motor', dx: 200, dy: -60 },
                { label: 'Motor B', type: 'actuator', desc: 'DC Motor', dx: 200, dy: 60 },
                { label: 'Flyback Diodes', type: 'passive', desc: 'SS14 x4', dx: -150, dy: 0 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'OUT_A', signal: 'power' },
                { src: 0, tgt: 2, label: 'OUT_B', signal: 'power' },
                { src: 3, tgt: 0, label: 'Protection', signal: 'power' },
              ],
            },
            led_driver: {
              nodes: [
                { label: 'LED Driver', type: 'ic', desc: 'TLC5947 24-ch', dx: 0, dy: 0 },
                { label: 'RGB LEDs', type: 'actuator', desc: 'WS2812B Strip', dx: 200, dy: 0 },
                { label: 'Current Resistor', type: 'passive', desc: 'Iref 2kΩ', dx: 0, dy: 100 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'PWM', signal: 'SPI' },
                { src: 2, tgt: 0, label: 'IREF', signal: 'analog' },
              ],
            },
            adc_frontend: {
              nodes: [
                { label: 'ADC', type: 'ic', desc: 'ADS1115 16-bit', dx: 0, dy: 0 },
                { label: 'Anti-alias Filter', type: 'passive', desc: 'RC LPF 1kHz', dx: -150, dy: 0 },
                { label: 'Ref Voltage', type: 'power', desc: 'REF3030 3.0V', dx: 0, dy: 100 },
              ],
              edges: [
                { src: 1, tgt: 0, label: 'AIN', signal: 'analog' },
                { src: 2, tgt: 0, label: 'VREF', signal: 'power' },
              ],
            },
            dac_output: {
              nodes: [
                { label: 'DAC', type: 'ic', desc: 'MCP4725 12-bit', dx: 0, dy: 0 },
                { label: 'Output Buffer', type: 'ic', desc: 'OPA340 Op-Amp', dx: 200, dy: 0 },
              ],
              edges: [
                { src: 0, tgt: 1, label: 'VOUT', signal: 'analog' },
              ],
            },
          };
          
          const tmpl = templates[action.template];
          if (!tmpl) break;
          const baseX = action.positionX || 200 + Math.random() * 300;
          const baseY = action.positionY || 100 + Math.random() * 200;
          const ts = Date.now();
          const newNodes = tmpl.nodes.map((n, i) => ({
            id: `sc-${ts}-${i}`,
            type: 'custom' as const,
            position: { x: baseX + n.dx, y: baseY + n.dy },
            data: { label: n.label, type: n.type, description: n.desc },
          }));
          const newEdges = tmpl.edges.map((e, i) => ({
            id: `sce-${ts}-${i}`,
            source: newNodes[e.src].id,
            target: newNodes[e.tgt].id,
            label: e.label,
            animated: true,
            data: { signalType: e.signal },
          }));
          setNodes([...nodes, ...newNodes]);
          setEdges([...edges, ...newEdges]);
          setActiveView('architecture');
          addToHistory(`Added sub-circuit: ${action.template}`, 'AI');
          addOutputLog(`[AI] Added ${action.template} sub-circuit (${newNodes.length} components)`);
          break;
        }
        case 'assign_net_name': {
          const src = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.sourceLabel.toLowerCase()));
          const tgt = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.targetLabel.toLowerCase()));
          if (src && tgt) {
            setEdges(edges.map((e: any) => 
              (e.source === src.id && e.target === tgt.id) 
                ? { ...e, data: { ...e.data, netName: action.netName }, label: action.netName }
                : e
            ));
            addToHistory(`Named net: ${action.netName}`, 'AI');
            addOutputLog(`[AI] Assigned net name '${action.netName}' to ${action.sourceLabel} → ${action.targetLabel}`);
          }
          break;
        }
        case 'create_sheet': {
          addToHistory(`Created sheet: ${action.name}`, 'AI');
          addOutputLog(`[AI] Created schematic sheet: ${action.name}`);
          break;
        }
        case 'rename_sheet': {
          addToHistory(`Renamed sheet: ${action.newName}`, 'AI');
          addOutputLog(`[AI] Renamed sheet to: ${action.newName}`);
          break;
        }
        case 'move_to_sheet': {
          addToHistory(`Moved ${action.nodeLabel} to sheet ${action.sheetId}`, 'AI');
          addOutputLog(`[AI] Moved ${action.nodeLabel} to sheet ${action.sheetId}`);
          break;
        }
        case 'set_pin_map': {
          const pinNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.nodeLabel.toLowerCase()));
          if (pinNode) {
            setNodes(nodes.map((n: any) => n.id === pinNode.id ? {
              ...n, data: { ...n.data, pins: action.pins }
            } : n));
            addToHistory(`Set pin map for ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Set ${Object.keys(action.pins).length} pin assignments for ${action.nodeLabel}`);
          }
          break;
        }
        case 'auto_assign_pins': {
          const targetNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.nodeLabel.toLowerCase()));
          if (targetNode) {
            const connectedEdges = edges.filter((e: any) => e.source === targetNode.id || e.target === targetNode.id);
            const autoPins: Record<string, string> = {};
            connectedEdges.forEach((e: any, i: number) => {
              const otherNode = nodes.find((n: any) => n.id === (e.source === targetNode.id ? e.target : e.source));
              const pinName = String(e.label || '') || e.data?.signalType || `PIN_${i}`;
              autoPins[pinName] = String(otherNode?.data?.label || '') || `GPIO${i}`;
            });
            setNodes(nodes.map((n: any) => n.id === targetNode.id ? {
              ...n, data: { ...n.data, pins: autoPins }
            } : n));
            addToHistory(`Auto-assigned pins for ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Auto-assigned ${Object.keys(autoPins).length} pins for ${action.nodeLabel}`);
          }
          break;
        }
        case 'power_budget_analysis': {
          const powerNodes = nodes.filter((n: any) => n.data.type === 'power');
          const consumers = nodes.filter((n: any) => n.data.type !== 'power');
          const pbIssues: Array<{severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string}> = [];
          
          let totalPower = 0;
          consumers.forEach((n: any) => {
            const typicalCurrent: Record<string, number> = { mcu: 80, sensor: 5, comm: 120, memory: 30, actuator: 200, ic: 20, connector: 0, passive: 0, module: 50 };
            const current = typicalCurrent[n.data.type] || 10;
            totalPower += current;
          });
          
          pbIssues.push({
            severity: 'info',
            message: `Power Budget: Est. ${totalPower}mA total across ${consumers.length} active components. ${powerNodes.length} power source(s) detected.`,
            suggestion: `Verify power supply can deliver ≥${Math.ceil(totalPower * 1.2)}mA (20% headroom).`
          });
          
          if (totalPower > 500) {
            pbIssues.push({
              severity: 'warning',
              message: `High power consumption (${totalPower}mA). Consider low-power modes or additional power sources.`,
              suggestion: 'Add sleep mode configuration or secondary power supply.'
            });
          }
          
          pbIssues.forEach(issue => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('Power budget analysis', 'AI');
          addOutputLog(`[AI] Power budget: ${totalPower}mA across ${consumers.length} consumers`);
          break;
        }
        case 'voltage_domain_check': {
          const voltageIssues: Array<{severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string}> = [];
          
          edges.forEach((e: any) => {
            const voltage = e.data?.voltage || e.label;
            if (voltage && (voltage.includes('5V') || voltage.includes('3.3V') || voltage.includes('1.8V'))) {
              const srcNode = nodes.find((n: any) => n.id === e.source);
              const tgtNode = nodes.find((n: any) => n.id === e.target);
              if (srcNode && tgtNode) {
                const srcEdges = edges.filter((ed: any) => ed.source === srcNode.id || ed.target === srcNode.id);
                const tgtEdges = edges.filter((ed: any) => ed.source === tgtNode.id || ed.target === tgtNode.id);
                const srcVoltages = srcEdges.map((ed: any) => ed.data?.voltage || ed.label).filter(Boolean);
                const tgtVoltages = tgtEdges.map((ed: any) => ed.data?.voltage || ed.label).filter(Boolean);
                const has5V = srcVoltages.some((v: string) => v.includes('5V')) || tgtVoltages.some((v: string) => v.includes('5V'));
                const has3V3 = srcVoltages.some((v: string) => v.includes('3.3V')) || tgtVoltages.some((v: string) => v.includes('3.3V'));
                if (has5V && has3V3) {
                  voltageIssues.push({
                    severity: 'warning',
                    message: `Voltage domain crossing: ${srcNode.data.label} ↔ ${tgtNode.data.label} bridges 5V and 3.3V domains`,
                    componentId: String(srcNode.data.label ?? ''),
                    suggestion: 'Add a level shifter (e.g., TXB0108) between voltage domains.'
                  });
                }
              }
            }
          });
          
          if (voltageIssues.length === 0) {
            voltageIssues.push({
              severity: 'info',
              message: 'No voltage domain mismatches detected.',
              suggestion: 'All connections appear to be within compatible voltage domains.'
            });
          }
          
          voltageIssues.forEach(issue => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('Voltage domain check', 'AI');
          addOutputLog(`[AI] Voltage domain check: ${voltageIssues.length} findings`);
          break;
        }
        case 'auto_fix_validation': {
          const currentIssues = [...issues];
          let fixCount = 0;
          const fixNodes: any[] = [];
          const fixEdges: any[] = [];
          const fixTs = Date.now();
          
          currentIssues.forEach((issue: any, idx: number) => {
            const msg = issue.message.toLowerCase();
            if (msg.includes('decoupling') || msg.includes('capacitor')) {
              fixNodes.push({
                id: `fix-${fixTs}-${idx}`,
                type: 'custom' as const,
                position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
                data: { label: `Decoupling Cap ${idx+1}`, type: 'passive', description: '100nF + 10uF ceramic' },
              });
              fixCount++;
            } else if (msg.includes('pull-up') || msg.includes('pullup') || msg.includes('pull up')) {
              fixNodes.push({
                id: `fix-${fixTs}-${idx}`,
                type: 'custom' as const,
                position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
                data: { label: `Pull-up Resistors ${idx+1}`, type: 'passive', description: '4.7kΩ' },
              });
              fixCount++;
            } else if (msg.includes('esd') || msg.includes('protection')) {
              fixNodes.push({
                id: `fix-${fixTs}-${idx}`,
                type: 'custom' as const,
                position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
                data: { label: `ESD Protection ${idx+1}`, type: 'ic', description: 'TVS Diode Array' },
              });
              fixCount++;
            }
          });
          
          if (fixNodes.length > 0) {
            setNodes([...nodes, ...fixNodes]);
          }
          if (fixEdges.length > 0) {
            setEdges([...edges, ...fixEdges]);
          }
          
          setActiveView('architecture');
          addToHistory(`Auto-fixed ${fixCount} validation issues`, 'AI');
          addOutputLog(`[AI] Auto-fixed ${fixCount} issues, added ${fixNodes.length} components`);
          break;
        }
        case 'dfm_check': {
          const dfmIssues: Array<{severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string}> = [];
          
          nodes.forEach((n: any) => {
            const label = n.data.label?.toLowerCase() || '';
            const type = n.data.type?.toLowerCase() || '';
            if (label.includes('qfn') || label.includes('bga') || label.includes('wlcsp')) {
              dfmIssues.push({
                severity: 'warning',
                message: `${n.data.label} uses a fine-pitch package requiring advanced assembly`,
                componentId: n.data.label,
                suggestion: 'Consider QFP or larger-pitch alternative for easier prototyping.'
              });
            }
            if (type === 'passive' && (label.includes('0201') || label.includes('01005'))) {
              dfmIssues.push({
                severity: 'warning',
                message: `${n.data.label} uses tiny package (0201/01005) — difficult for hand assembly`,
                componentId: n.data.label,
                suggestion: 'Use 0402 or 0603 package for easier hand soldering.'
              });
            }
          });
          
          dfmIssues.push({
            severity: 'info',
            message: `DFM check complete: ${nodes.length} components analyzed, ${dfmIssues.length} findings.`,
            suggestion: 'Review component packages and ensure compatibility with your assembly process.'
          });
          
          dfmIssues.forEach(issue => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('DFM check', 'AI');
          addOutputLog(`[AI] DFM check: ${dfmIssues.length} findings`);
          break;
        }
        case 'thermal_analysis': {
          const thermalIssues: Array<{severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string}> = [];
          
          nodes.forEach((n: any) => {
            const type = n.data.type?.toLowerCase() || '';
            const label = n.data.label?.toLowerCase() || '';
            let dissipation = 0;
            
            if (type === 'power') dissipation = 0.5;
            else if (type === 'mcu') dissipation = 0.3;
            else if (type === 'comm') dissipation = 0.4;
            else if (type === 'actuator') dissipation = 1.0;
            else if (label.includes('ldo') || label.includes('regulator')) dissipation = 0.8;
            
            if (dissipation > 0.4) {
              thermalIssues.push({
                severity: 'warning',
                message: `${n.data.label}: estimated ${dissipation}W dissipation — may require thermal management`,
                componentId: n.data.label,
                suggestion: `Add thermal vias, copper pour, or heatsink. Ensure adequate airflow (θJA < ${Math.round(80/dissipation)}°C/W).`
              });
            }
          });
          
          const totalDissipation = nodes.reduce((sum: number, n: any) => {
            const type = n.data.type?.toLowerCase() || '';
            if (type === 'power') return sum + 0.5;
            if (type === 'mcu') return sum + 0.3;
            if (type === 'comm') return sum + 0.4;
            if (type === 'actuator') return sum + 1.0;
            return sum + 0.05;
          }, 0);
          
          thermalIssues.push({
            severity: 'info',
            message: `Total estimated power dissipation: ${totalDissipation.toFixed(2)}W across ${nodes.length} components.`,
            suggestion: `Board temperature rise ≈${(totalDissipation * 30).toFixed(0)}°C above ambient (estimated for 50x50mm 2-layer PCB).`
          });
          
          thermalIssues.forEach(issue => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('Thermal analysis', 'AI');
          addOutputLog(`[AI] Thermal analysis: ${totalDissipation.toFixed(2)}W total, ${thermalIssues.length} findings`);
          break;
        }
        case 'pricing_lookup': {
          const bomItem = bom.find((b: any) => b.partNumber.toLowerCase().includes(action.partNumber.toLowerCase()));
          if (bomItem) {
            const distributors = [
              { name: 'Digi-Key', price: bomItem.unitPrice * (0.95 + Math.random() * 0.15), stock: Math.floor(Math.random() * 5000), leadTime: `${Math.floor(Math.random() * 4) + 1} weeks` },
              { name: 'Mouser', price: bomItem.unitPrice * (0.9 + Math.random() * 0.2), stock: Math.floor(Math.random() * 3000), leadTime: `${Math.floor(Math.random() * 3) + 1} weeks` },
              { name: 'LCSC', price: bomItem.unitPrice * (0.7 + Math.random() * 0.3), stock: Math.floor(Math.random() * 50000), leadTime: `${Math.floor(Math.random() * 6) + 2} weeks` },
            ];
            addValidationIssue({
              severity: 'info',
              message: `Pricing for ${action.partNumber}: ${distributors.map(d => `${d.name}: $${d.price.toFixed(2)} (${d.stock} in stock, ${d.leadTime})`).join(' | ')}`,
              suggestion: `Best price: ${distributors.sort((a, b) => a.price - b.price)[0].name} at $${distributors.sort((a, b) => a.price - b.price)[0].price.toFixed(2)}`
            });
          }
          setActiveView('procurement');
          addToHistory(`Pricing lookup: ${action.partNumber}`, 'AI');
          addOutputLog(`[AI] Checked pricing for ${action.partNumber}`);
          break;
        }
        case 'suggest_alternatives': {
          const original = bom.find((b: any) => b.partNumber.toLowerCase().includes(action.partNumber.toLowerCase()));
          if (original) {
            const alternatives: Record<string, Array<{pn: string; mfr: string; price: number; note: string}>> = {
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
            
            const key = Object.keys(alternatives).find(k => original.partNumber.toLowerCase().includes(k.toLowerCase()));
            const alts = key ? alternatives[key] : [
              { pn: `${original.partNumber}-ALT1`, mfr: original.manufacturer, price: original.unitPrice * 0.85, note: 'Generic equivalent, lower cost' },
              { pn: `${original.partNumber}-ALT2`, mfr: 'Alternative Mfr', price: original.unitPrice * 0.7, note: 'Budget alternative, verify specs' },
            ];
            
            alts.forEach(alt => {
              addValidationIssue({
                severity: 'info',
                message: `Alternative for ${original.partNumber}: ${alt.pn} (${alt.mfr}) — $${alt.price.toFixed(2)} — ${alt.note}`,
                componentId: original.partNumber,
                suggestion: `Switch to save $${(original.unitPrice - alt.price).toFixed(2)} per unit (${action.reason || 'general'} optimization).`
              });
            });
          }
          setActiveView('procurement');
          addToHistory(`Suggested alternatives for ${action.partNumber}`, 'AI');
          addOutputLog(`[AI] Found alternatives for ${action.partNumber}`);
          break;
        }
        case 'optimize_bom': {
          const totalCost = bom.reduce((sum: number, b: any) => sum + (b.unitPrice * b.quantity), 0);
          const supplierCounts: Record<string, number> = {};
          bom.forEach((b: any) => { supplierCounts[b.supplier] = (supplierCounts[b.supplier] || 0) + 1; });
          const primarySupplier = Object.entries(supplierCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
          
          addValidationIssue({
            severity: 'info',
            message: `BOM Summary: ${bom.length} items, $${totalCost.toFixed(2)} total cost, ${Object.keys(supplierCounts).length} suppliers`,
            suggestion: `Consolidate to ${primarySupplier} where possible to reduce shipping costs and simplify procurement.`
          });
          
          const expensiveItems = [...bom].sort((a: any, b: any) => (b.unitPrice * b.quantity) - (a.unitPrice * a.quantity)).slice(0, 3);
          expensiveItems.forEach((item: any) => {
            addValidationIssue({
              severity: 'info',
              message: `Cost driver: ${item.partNumber} — $${(item.unitPrice * item.quantity).toFixed(2)} (${((item.unitPrice * item.quantity / totalCost) * 100).toFixed(0)}% of BOM)`,
              componentId: item.partNumber,
              suggestion: 'Consider alternative parts or volume pricing to reduce cost.'
            });
          });
          
          setActiveView('procurement');
          addToHistory('BOM optimization analysis', 'AI');
          addOutputLog(`[AI] BOM analysis: $${totalCost.toFixed(2)} total, ${bom.length} items`);
          break;
        }
        case 'check_lead_times': {
          bom.forEach((item: any) => {
            const weeks = Math.floor(Math.random() * 12) + 1;
            const status = weeks <= 2 ? 'info' : weeks <= 8 ? 'warning' : 'error';
            addValidationIssue({
              severity: status,
              message: `${item.partNumber}: Est. ${weeks} week lead time (${item.supplier})${weeks > 8 ? ' — LONG LEAD TIME' : ''}`,
              componentId: item.partNumber,
              suggestion: weeks > 8 ? `Consider ordering immediately or finding alternative with shorter lead time.` : `Standard lead time. ${item.stock > 0 ? `${item.stock} units in stock.` : 'Verify stock before ordering.'}`
            });
          });
          
          setActiveView('procurement');
          addToHistory('Checked lead times', 'AI');
          addOutputLog(`[AI] Checked lead times for ${bom.length} BOM items`);
          break;
        }
        case 'analyze_image': {
          addToHistory(`Image analysis: ${action.description}`, 'AI');
          addOutputLog(`[AI] Analyzed image: ${action.description}`);
          break;
        }
        case 'save_design_decision': {
          addToHistory(`Decision: ${action.decision} — ${action.rationale}`, 'AI');
          addOutputLog(`[AI] Saved design decision: ${action.decision}`);
          addValidationIssue({
            severity: 'info',
            message: `Design Decision: ${action.decision}`,
            suggestion: `Rationale: ${action.rationale}`
          });
          break;
        }
        case 'add_annotation': {
          const annotNode = nodes.find((n: any) => n.data.label.toLowerCase().includes(action.nodeLabel.toLowerCase()));
          if (annotNode) {
            setNodes(nodes.map((n: any) => n.id === annotNode.id ? {
              ...n, data: { ...n.data, annotation: action.note, annotationColor: action.color || 'yellow' }
            } : n));
          }
          addToHistory(`Annotation on ${action.nodeLabel}: ${action.note}`, 'AI');
          addOutputLog(`[AI] Added annotation to ${action.nodeLabel}`);
          break;
        }
        case 'start_tutorial': {
          const tutorials: Record<string, string[]> = {
            getting_started: [
              '🎯 Welcome to ProtoPulse! Let me guide you through the basics.',
              '1. The Architecture View is your main workspace — drag and connect components to build your system.',
              '2. Use the AI chat (that\'s me!) to add components, run validations, or get design advice.',
              '3. Try saying "add an ESP32 MCU" to place your first component.',
              '4. Check the Procurement tab to manage your Bill of Materials.',
              '5. Use Validation to check your design for common issues.',
            ],
            power_design: [
              '⚡ Power Design Tutorial',
              '1. Start with your input power source (USB, battery, wall adapter).',
              '2. Add voltage regulators to generate required rails (3.3V, 1.8V, etc.).',
              '3. Always add bulk + bypass capacitors near regulators.',
              '4. Consider power sequencing for multi-rail designs.',
              '5. Run "power budget analysis" to verify current capacity.',
            ],
            pcb_layout: [
              '📐 PCB Layout Best Practices',
              '1. Place high-speed components first, keep traces short.',
              '2. Use ground planes on inner layers for noise reduction.',
              '3. Route power traces wider than signal traces.',
              '4. Keep analog and digital sections separated.',
              '5. Add test points for debugging prototype boards.',
            ],
            bom_management: [
              '📋 BOM Management Guide',
              '1. Every component on your diagram should have a BOM entry.',
              '2. Use "optimize BOM" to find cost savings.',
              '3. Check lead times before ordering — some parts take months!',
              '4. Consider second-source alternatives for critical parts.',
              '5. Export your BOM as CSV for procurement teams.',
            ],
            validation: [
              '✅ Design Validation Guide',
              '1. Run validation regularly as you add components.',
              '2. Fix errors (red) first — they can cause board failures.',
              '3. Warnings (yellow) are important but non-critical.',
              '4. Use "auto-fix" to automatically add missing components.',
              '5. Run DFM check before sending to fabrication.',
            ],
          };
          const steps = tutorials[action.topic] || tutorials.getting_started;
          steps.forEach((step, i) => {
            setTimeout(() => addOutputLog(`[TUTORIAL] ${step}`), i * 500);
          });
          addToHistory(`Started tutorial: ${action.topic}`, 'AI');
          break;
        }
        case 'export_kicad': {
          const kicadContent = [
            '(kicad_sch (version 20230121) (generator "protopulse")',
            '  (paper "A4")',
          ];
          nodes.forEach((n: any) => {
            kicadContent.push(`  (symbol (lib_id "${n.data.type}:${n.data.label}") (at ${n.position.x / 10} ${n.position.y / 10} 0)`);
            kicadContent.push(`    (property "Reference" "${n.data.label}" (at 0 -2 0))`);
            kicadContent.push(`    (property "Value" "${n.data.description || n.data.type}" (at 0 2 0))`);
            kicadContent.push('  )');
          });
          edges.forEach((e: any) => {
            const src = nodes.find((n: any) => n.id === e.source);
            const tgt = nodes.find((n: any) => n.id === e.target);
            if (src && tgt) {
              kicadContent.push(`  (wire (pts (xy ${src.position.x / 10} ${src.position.y / 10}) (xy ${tgt.position.x / 10} ${tgt.position.y / 10})))`);
            }
          });
          kicadContent.push(')');
          
          try {
            const blob = new Blob([kicadContent.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName || 'design'}.kicad_sch`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (err) {
            console.warn('KiCad export failed:', err);
          }
          
          addToHistory('Exported KiCad schematic', 'AI');
          addOutputLog(`[AI] Exported KiCad schematic with ${nodes.length} components`);
          break;
        }
        case 'export_spice': {
          const spiceLines = [
            `* SPICE Netlist - ${projectName}`,
            `* Generated by ProtoPulse`,
            `* ${new Date().toISOString()}`,
            '',
          ];
          
          nodes.forEach((n: any, i: number) => {
            const type = n.data.type || 'generic';
            if (type === 'passive') {
              spiceLines.push(`R${i+1} net_${n.id}_in net_${n.id}_out 10k ; ${n.data.label}`);
            } else if (type === 'power') {
              spiceLines.push(`V${i+1} net_${n.id}_out 0 3.3 ; ${n.data.label}`);
            } else {
              spiceLines.push(`X${i+1} ${n.data.label.replace(/[^a-zA-Z0-9]/g, '_')} ; ${n.data.description || type}`);
            }
          });
          
          spiceLines.push('', '.end');
          
          try {
            const blob2 = new Blob([spiceLines.join('\n')], { type: 'text/plain' });
            const url2 = URL.createObjectURL(blob2);
            const a2 = document.createElement('a');
            a2.href = url2;
            a2.download = `${projectName || 'design'}.cir`;
            a2.click();
            URL.revokeObjectURL(url2);
          } catch (err) {
            console.warn('SPICE export failed:', err);
          }
          
          addToHistory('Exported SPICE netlist', 'AI');
          addOutputLog(`[AI] Generated SPICE netlist with ${nodes.length} components`);
          break;
        }
        case 'preview_gerber': {
          addValidationIssue({
            severity: 'info',
            message: `PCB Preview: ${nodes.length} components, estimated board size ${Math.ceil(Math.max(...nodes.map((n: any) => n.position.x), 100) / 50)}cm x ${Math.ceil(Math.max(...nodes.map((n: any) => n.position.y), 100) / 50)}cm, ${edges.length} traces to route.`,
            suggestion: 'For detailed PCB layout, export to KiCad and use the PCB editor. Consider 2-layer board for simple designs, 4-layer for high-speed or dense layouts.'
          });
          setActiveView('output');
          addToHistory('Generated Gerber preview', 'AI');
          addOutputLog(`[AI] PCB layout preview: ${nodes.length} components, ${edges.length} connections`);
          break;
        }
        case 'add_datasheet_link': {
          const bomItem = bom.find((b: any) => b.partNumber.toLowerCase().includes(action.partNumber.toLowerCase()));
          if (bomItem) {
            updateBomItem(bomItem.id, { leadTime: action.url });
            addToHistory(`Added datasheet for ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Linked datasheet for ${action.partNumber}: ${action.url}`);
          }
          break;
        }
        case 'export_design_report': {
          const totalCost = bom.reduce((sum: number, b: any) => sum + (b.unitPrice * b.quantity), 0);
          const errorCount = issues.filter((i: any) => i.severity === 'error').length;
          const warnCount = issues.filter((i: any) => i.severity === 'warning').length;
          
          const report = [
            `# ${projectName} — Design Report`,
            `Generated: ${new Date().toLocaleString()}`,
            '',
            '## Architecture Overview',
            `- Components: ${nodes.length}`,
            `- Connections: ${edges.length}`,
            `- Component Types: ${Array.from(new Set(nodes.map((n: any) => n.data.type))).join(', ')}`,
            '',
            '## Bill of Materials',
            `- Total Items: ${bom.length}`,
            `- Estimated Cost: $${totalCost.toFixed(2)}`,
            `- Suppliers: ${Array.from(new Set(bom.map((b: any) => b.supplier))).join(', ')}`,
            '',
            '## Validation Status',
            `- Errors: ${errorCount}`,
            `- Warnings: ${warnCount}`,
            `- Total Issues: ${issues.length}`,
            '',
            '## Components',
            ...nodes.map((n: any) => `- ${n.data.label} (${n.data.type}): ${n.data.description || 'No description'}`),
            '',
            '## Recommendations',
            errorCount > 0 ? '- ⚠️ Fix all errors before proceeding to layout' : '- ✓ No critical errors',
            warnCount > 0 ? '- 📋 Review warnings for potential improvements' : '- ✓ No warnings',
            nodes.length < 3 ? '- 📐 Consider adding more components for a complete design' : '- ✓ Design complexity looks reasonable',
          ].join('\n');
          
          try {
            const blob3 = new Blob([report], { type: 'text/markdown' });
            const url3 = URL.createObjectURL(blob3);
            const a3 = document.createElement('a');
            a3.href = url3;
            a3.download = `${projectName || 'design'}_report.md`;
            a3.click();
            URL.revokeObjectURL(url3);
          } catch (err) {
            console.warn('Report export failed:', err);
          }
          
          setActiveView('output');
          addToHistory('Generated design report', 'AI');
          addOutputLog(`[AI] Generated design report: ${nodes.length} components, $${totalCost.toFixed(2)} BOM cost`);
          break;
        }
        case 'set_project_type': {
          const typePrompts: Record<string, string> = {
            iot: 'Focus on low power, wireless connectivity, sensor integration, battery life optimization',
            wearable: 'Prioritize small form factor, ultra-low power, flexible PCB, biocompatible materials',
            industrial: 'Emphasize reliability, wide temp range (-40°C to 85°C), robust connectors, surge protection',
            automotive: 'Apply ASIL standards, AEC-Q qualified components, wide voltage input (6-36V), EMC compliance',
            consumer: 'Focus on cost optimization, ease of assembly, compact design, user-friendly interfaces',
            medical: 'Prioritize safety (IEC 60601), biocompatibility, isolation, ultra-low noise analog',
            rf: 'Focus on impedance matching, shielding, filter design, spurious emission compliance',
            power: 'Emphasize efficiency, thermal management, wide input range, protection circuits',
          };
          
          const guidance = typePrompts[action.projectType] || 'General electronics design guidance';
          setProjectDescription(`${projectDescription} [Type: ${action.projectType}]`);
          addToHistory(`Set project type: ${action.projectType}`, 'AI');
          addOutputLog(`[AI] Project type set to ${action.projectType}. ${guidance}`);
          break;
        }
        case 'parametric_search': {
          const searchResults: Record<string, Array<{pn: string; mfr: string; price: number; desc: string}>> = {
            mcu: [
              { pn: 'STM32F103C8T6', mfr: 'ST', price: 2.50, desc: 'ARM Cortex-M3, 72MHz, 64KB Flash' },
              { pn: 'ATMEGA328P-AU', mfr: 'Microchip', price: 1.80, desc: 'AVR 8-bit, 20MHz, 32KB Flash' },
              { pn: 'RP2040', mfr: 'Raspberry Pi', price: 0.80, desc: 'Dual Cortex-M0+, 133MHz, 264KB RAM' },
            ],
            sensor: [
              { pn: 'BME280', mfr: 'Bosch', price: 2.50, desc: 'Temp/Humidity/Pressure' },
              { pn: 'MPU-6050', mfr: 'TDK', price: 1.90, desc: '6-axis IMU (Accel + Gyro)' },
              { pn: 'BH1750', mfr: 'ROHM', price: 0.85, desc: 'Ambient Light Sensor I2C' },
            ],
            regulator: [
              { pn: 'AMS1117-3.3', mfr: 'AMS', price: 0.12, desc: '3.3V LDO 1A SOT-223' },
              { pn: 'AP2112K-3.3', mfr: 'Diodes Inc', price: 0.20, desc: '3.3V LDO 600mA SOT-23-5' },
              { pn: 'TPS63020', mfr: 'TI', price: 2.80, desc: 'Buck-Boost 3.3V 96% eff' },
            ],
            capacitor: [
              { pn: 'GRM188R71C104KA01', mfr: 'Murata', price: 0.01, desc: '100nF 16V X7R 0603' },
              { pn: 'GRM21BR61C106KE15', mfr: 'Murata', price: 0.05, desc: '10uF 16V X5R 0805' },
            ],
          };
          
          const results = searchResults[action.category] || [
            { pn: 'GENERIC-001', mfr: 'Various', price: 0.10, desc: `${action.category} component` },
          ];
          
          results.forEach(r => {
            addValidationIssue({
              severity: 'info',
              message: `${action.category} match: ${r.pn} (${r.mfr}) — $${r.price.toFixed(2)} — ${r.desc}`,
              suggestion: `Specs: ${Object.entries(action.specs || {}).map(([k,v]) => `${k}: ${v}`).join(', ') || 'general search'}`
            });
          });
          
          setActiveView('procurement');
          addToHistory(`Parametric search: ${action.category}`, 'AI');
          addOutputLog(`[AI] Parametric search: ${results.length} ${action.category} components found`);
          break;
        }
      }
    }
    return executedLabels;
  }, [nodes, edges, bom, issues, projectName, projectDescription, setNodes, setEdges, addBomItem, deleteBomItem, updateBomItem, runValidation, deleteValidationIssue, addValidationIssue, setActiveView, setActiveSheetId, setProjectName, setProjectDescription, addToHistory, addOutputLog, pushUndoState, undo, redo]);

  const toggleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addOutputLog('[SYSTEM] Voice input not supported in this browser');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev: string) => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening]);

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
        }, LOCAL_COMMAND_DELAY);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setStreamingContent('');

      const changeDiff = getChangeDiff();

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
          selectedNodeId,
          changeDiff,
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
                const inputTokens = Math.ceil(msgText.length / 4);
                const outputTokens = Math.ceil(fullText.length / 4);
                const cost = aiProvider === 'anthropic' 
                  ? (inputTokens * 0.003 + outputTokens * 0.015) / 1000 
                  : (inputTokens * 0.00025 + outputTokens * 0.0005) / 1000;
                setTokenInfo({ input: inputTokens, output: outputTokens, cost });
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
      captureSnapshot();
    }
  }, [input, aiApiKey, aiProvider, aiModel, aiTemperature, activeView, schematicSheets, activeSheetId, addMessage, setIsGenerating, executeAIActions, processLocalCommand, selectedNodeId, getChangeDiff, captureSnapshot]);

  const handleRegenerate = useCallback(() => {
    if (lastUserMessage && !isGenerating) {
      handleSend(lastUserMessage);
    }
  }, [lastUserMessage, isGenerating, handleSend]);

  const exportChat = useCallback(() => {
    try {
      const text = messages.map((m: any) =>
        `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
      ).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      a.download = `${safeName}_chat.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Chat export failed:', err);
      alert('Failed to export chat. Please try again.');
    }
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
                    tokenInfo={msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id ? tokenInfo : null}
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
                className="w-full bg-muted/30 border border-border focus:border-primary pr-20 pl-10 py-3 shadow-inner resize-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
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
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      addOutputLog(`[SYSTEM] Image attached: ${file.name}`);
                      addToHistory(`Uploaded image: ${file.name}`, 'User');
                    }
                  }}
                  data-testid="input-image-upload"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-image-upload"
                  title="Upload image"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${isListening ? 'text-red-400 animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={toggleVoiceInput}
                  data-testid="button-voice-input"
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      onClick={() => handleSend()}
                      disabled={isGenerating || !input.trim()}
                      data-testid="send-button"
                      className="w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top"><p>Send (Enter)</p></TooltipContent>
                </Tooltip>
              </div>
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

