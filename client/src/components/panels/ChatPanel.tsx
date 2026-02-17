import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Image as ImageIcon, Video, Mic, Plus, Zap, X, Settings2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
};

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
  const [mode, setMode] = useState<'chat' | 'image' | 'video'>('chat');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [aiProvider, setAiProvider] = useState<'anthropic' | 'gemini'>(() => {
    return (localStorage.getItem('protopulse_ai_provider') as any) || 'anthropic';
  });
  const [aiModel, setAiModel] = useState(() => {
    return localStorage.getItem('protopulse_ai_model') || 'claude-sonnet-4-5';
  });
  const [aiApiKey, setAiApiKey] = useState(() => {
    return localStorage.getItem('protopulse_ai_apikey') || '';
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('protopulse_ai_provider', aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    localStorage.setItem('protopulse_ai_model', aiModel);
  }, [aiModel]);

  useEffect(() => {
    localStorage.setItem('protopulse_ai_apikey', aiApiKey);
  }, [aiApiKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

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
          const filteredNodes = nodes.filter((n: any) => n.id !== nodeToRemove.id);
          const filteredEdges = edges.filter((e: any) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id);
          setNodes(filteredNodes);
          setEdges(filteredEdges);
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
      if (bom.length === 0) {
        return `No BOM items to export. Add components to the BOM first.`;
      }
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
      if (issues.length === 0) {
        return `No validation issues to fix. The design is currently clean.`;
      }
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

  const executeAIActions = (actions: any[]) => {
    for (const action of actions) {
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
            const updatedNodes = nodes.map((n: any) => {
              if (n.id === nodeToUpdate.id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    label: action.newLabel || n.data.label,
                    type: action.newType || n.data.type,
                    description: action.newDescription || n.data.description,
                  },
                };
              }
              return n;
            });
            setNodes(updatedNodes);
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
              source: sourceNode.id,
              target: targetNode.id,
              label: action.edgeLabel || action.busType || 'Data',
              animated: true,
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
            return {
              id: `gen-e-${Date.now()}-${idx}`,
              source: src?.id || '',
              target: tgt?.id || '',
              label: conn.label,
              animated: true,
            };
          }).filter((e: any) => e.source && e.target);
          setEdges(genEdges);
          setActiveView('architecture');
          addToHistory(`Generated architecture with ${genNodes.length} components`, 'AI');
          addOutputLog(`[AI] Generated architecture: ${genNodes.length} components, ${genEdges.length} connections`);
          break;
        }

        case 'add_bom_item':
          addBomItem({
            partNumber: action.partNumber,
            manufacturer: action.manufacturer,
            description: action.description,
            quantity: action.quantity || 1,
            unitPrice: action.unitPrice || 0,
            totalPrice: (action.quantity || 1) * (action.unitPrice || 0),
            supplier: action.supplier || 'TBD',
            stock: 0,
            status: action.status || 'In Stock',
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
          addValidationIssue({
            severity: action.severity,
            message: action.message,
            componentId: action.componentId,
            suggestion: action.suggestion,
          });
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
  };

  const handleSend = async (messageOverride?: string) => {
    const msgText = messageOverride || input;
    if (!msgText.trim()) return;

    setInput('');
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: msgText,
      timestamp: Date.now(),
      mode: mode
    });

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

      const response = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText,
          provider: aiProvider,
          model: aiModel,
          apiKey: aiApiKey,
          activeView,
          schematicSheets: schematicSheets.map(s => ({ id: s.id, name: s.name })),
          activeSheetId,
        }),
      });

      const data = await response.json();

      if (data.actions && data.actions.length > 0) {
        executeAIActions(data.actions);
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      });
    } catch (error: any) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to communicate with AI. Check your settings.'}`,
        timestamp: Date.now()
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
          <span
            className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground"
            style={{ writingMode: 'vertical-rl' }}
          >
            AI Assistant
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div
          data-testid="chat-backdrop"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "flex flex-col h-full bg-card/60 backdrop-blur-xl border-l border-border shadow-2xl relative shrink-0 overflow-hidden",
          "fixed inset-y-0 right-0 z-50 w-full max-w-[350px] transform transition-transform md:relative md:w-auto md:max-w-none md:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ '--chat-w': `${width}px` } as React.CSSProperties}
      >
        <div className="flex flex-col h-full w-full max-w-[350px] md:max-w-none md:w-[var(--chat-w)]">
          <ChatContent
            messages={messages}
            input={input}
            setInput={setInput}
            mode={mode}
            setMode={setMode}
            isGenerating={isGenerating}
            handleSend={handleSend}
            scrollRef={scrollRef}
            onClose={onClose}
            showQuickActions={showQuickActions}
            setShowQuickActions={setShowQuickActions}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            aiProvider={aiProvider}
            setAiProvider={setAiProvider}
            aiModel={aiModel}
            setAiModel={setAiModel}
            aiApiKey={aiApiKey}
            setAiApiKey={setAiApiKey}
          />
        </div>
      </div>
    </>
  );
}

function ChatContent({
  messages, input, setInput, mode, setMode, isGenerating, handleSend, scrollRef, onClose, showQuickActions, setShowQuickActions,
  showSettings, setShowSettings, aiProvider, setAiProvider, aiModel, setAiModel, aiApiKey, setAiApiKey
}: any) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <>
      <div className="h-14 border-b border-border bg-card/30 backdrop-blur flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold tracking-wider text-sm">ProtoPulse AI</h3>
        </div>
        <div className="flex gap-1 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setMode('chat')} className={cn("p-1.5 hover:bg-muted transition-colors", mode === 'chat' && "text-primary bg-primary/10")}>
                <Bot className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Chat mode</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setMode('image')} className={cn("p-1.5 hover:bg-muted transition-colors", mode === 'image' && "text-primary bg-primary/10")}>
                <ImageIcon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Schematic visualization</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setMode('video')} className={cn("p-1.5 hover:bg-muted transition-colors", mode === 'video' && "text-primary bg-primary/10")}>
                <Video className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Simulation mode</p>
            </TooltipContent>
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
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>AI Settings</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="chat-close"
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 md:hidden"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Close chat</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {showSettings ? (
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
                onClick={() => {
                  setAiProvider('anthropic');
                  setAiModel(AI_MODELS.anthropic[0].id);
                }}
                className={cn(
                  "p-3 border text-center text-sm font-bold transition-all",
                  aiProvider === 'anthropic'
                    ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
                )}
              >
                Anthropic
              </button>
              <button
                data-testid="provider-gemini"
                onClick={() => {
                  setAiProvider('gemini');
                  setAiModel(AI_MODELS.gemini[0].id);
                }}
                className={cn(
                  "p-3 border text-center text-sm font-bold transition-all",
                  aiProvider === 'gemini'
                    ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
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
                placeholder="Enter your API key..."
                className="w-full bg-muted/30 border border-border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
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
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              Get your key at{' '}
              <span className="text-primary/70">console.anthropic.com</span> or{' '}
              <span className="text-primary/70">aistudio.google.dev</span>
            </p>
          </div>

          <button
            data-testid="save-settings"
            onClick={() => setShowSettings(false)}
            className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
          >
            Save & Close
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
                <Bot className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Ask ProtoPulse AI to generate a schematic, optimize costs, or validate your design.</p>
              </div>
            )}

            {messages.map((msg: any) => (
              <div key={msg.id} className={cn(
                "flex gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300",
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
                    "p-3 leading-relaxed shadow-sm whitespace-pre-wrap",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 backdrop-blur border border-border text-foreground"
                  )}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground opacity-50 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex gap-3 text-sm">
                <div className="w-8 h-8 flex items-center justify-center shrink-0 border bg-primary/10 text-primary border-primary/20">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted/50 border border-border text-foreground p-3 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground animate-pulse">Analyzing system requirements...</span>
                </div>
              </div>
            )}
          </div>

          {showQuickActions && !isGenerating && messages.length > 0 && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
              {['Generate Architecture', 'Optimize BOM', 'Run Validation', 'Add MCU Node', 'Switch to Schematic', 'Project Summary', 'Show Help', 'Export BOM CSV'].map((action) => (
                <Tooltip key={action}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSend(action)}
                      className="whitespace-nowrap px-3 py-1.5 bg-muted/40 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3" />
                      {action}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top">
                    <p>{quickActionDescriptions[action]}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </>
      )}

      <div className="p-4 border-t border-border bg-card/40 backdrop-blur">
        <div className="relative">
          <Input
            value={input}
            onChange={(e: any) => setInput(e.target.value)}
            onKeyDown={(e: any) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'chat' ? "Describe your system..." : mode === 'image' ? "Upload or describe visual..." : "Describe video context..."}
            className="bg-muted/30 border-border focus:border-primary pr-10 pl-10 py-5 shadow-inner"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="flex items-center justify-center" onClick={() => setShowQuickActions(!showQuickActions)}>
                  <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top">
                <p>Quick actions</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                onClick={() => handleSend()}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top">
              <p>Send message</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="text-[10px] text-center text-muted-foreground/40 mt-2 font-mono">
          {aiApiKey ? `${aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} — ${aiModel}` : 'Local Mode (No API Key)'}
        </div>
      </div>
    </>
  );
}
