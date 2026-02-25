import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bot, Sparkles, ArrowDown, Search } from 'lucide-react';
import { useChat } from '@/lib/contexts/chat-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useHistory } from '@/lib/contexts/history-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { type ChatMessage, type ViewMode } from '@/lib/project-context';
import { cn } from '@/lib/utils';

import { copyToClipboard } from '@/lib/clipboard';
import { AI_MODELS, DESTRUCTIVE_ACTIONS, COPY_FEEDBACK_DURATION, LOCAL_COMMAND_DELAY } from './chat/constants';
import MessageBubble from './chat/MessageBubble';
import SettingsPanel from './chat/SettingsPanel';
import ChatHeader from './chat/ChatHeader';
import ChatSearchBar from './chat/ChatSearchBar';
import StreamingIndicator from './chat/StreamingIndicator';
import FollowUpSuggestions from './chat/FollowUpSuggestions';
import MessageInput from './chat/MessageInput';
import { buildCSV, downloadBlob } from '@/lib/csv';
import { useChatSettings } from '@/hooks/useChatSettings';
import type { AIAction } from './chat/chat-types';
import { nodeData } from './chat/chat-types';
import { useActionExecutor } from './chat/hooks/useActionExecutor';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function ChatPanel({ isOpen, onClose, collapsed = false, width = 350, onToggleCollapse }: ChatPanelProps) {
  const { messages, addMessage, isGenerating, setIsGenerating } = useChat();
  const { runValidation, addValidationIssue, deleteValidationIssue, issues } = useValidation();
  const { setNodes, setEdges, nodes, edges, selectedNodeId, captureSnapshot, getChangeDiff } = useArchitecture();
  const { bom, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { activeView, setActiveView, activeSheetId, setActiveSheetId, projectName, setProjectName, projectDescription, setProjectDescription } = useProjectMeta();
  const { addToHistory } = useHistory();
  const { addOutputLog } = useOutput();
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = useProjectId();
  const { aiProvider, setAiProvider, aiModel, setAiModel, aiTemperature, setAiTemperature, customSystemPrompt, setCustomSystemPrompt } = useChatSettings();
  const [aiApiKey, setAiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pendingActions, setPendingActions] = useState<{ actions: AIAction[]; messageId: string } | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{input: number; output: number; cost: number} | null>(null);

  const filteredMessages = useMemo(() =>
    chatSearch
      ? messages.filter((m) => m.content.toLowerCase().includes(chatSearch.toLowerCase()))
      : messages,
    [messages, chatSearch]
  );

  const messageVirtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height + 16,
  });

  const scrollToBottom = useCallback(() => {
    if (filteredMessages.length > 0) {
      messageVirtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end' });
    }
  }, [filteredMessages.length, messageVirtualizer]);

  useEffect(() => { scrollToBottom(); }, [messages, isGenerating, streamingContent, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const processLocalCommand = useCallback((msgText: string): string => {
    const lower = msgText.toLowerCase().trim();

    const viewMap: Record<string, ViewMode> = {
      'architecture': 'architecture',
      'component editor': 'component_editor',
      'procurement': 'procurement',
      'validation': 'validation',
      'output': 'output',
    };
    for (const [key, view] of Object.entries(viewMap)) {
      if ((lower.includes('switch to') || lower.includes('go to') || lower.includes('show') || lower.includes('open')) && lower.includes(key)) {
        setActiveView(view);
        const viewLabel = key.charAt(0).toUpperCase() + key.slice(1);
        addToHistory(`Switched to ${viewLabel} view`, 'AI');
        addOutputLog(`[AI] Switched to ${viewLabel} view`);
        return `[ACTION] Switched to ${viewLabel} view.\n\nYou can manage your ${key} here.`;
      }
    }

    if (lower.includes('generate architecture') || lower.includes('generate schematic') || (lower.includes('generate') && (lower.includes('arch') || lower.includes('design')))) {
      const defaultNodes = [
        { id: crypto.randomUUID(), type: 'custom' as const, position: { x: 300, y: 100 }, data: { label: 'ESP32-S3', type: 'mcu', description: 'Main MCU' } },
        { id: crypto.randomUUID(), type: 'custom' as const, position: { x: 100, y: 250 }, data: { label: 'TP4056', type: 'power', description: 'Power Management' } },
        { id: crypto.randomUUID(), type: 'custom' as const, position: { x: 500, y: 250 }, data: { label: 'SX1262', type: 'comm', description: 'LoRa Communication' } },
        { id: crypto.randomUUID(), type: 'custom' as const, position: { x: 300, y: 400 }, data: { label: 'SHT40', type: 'sensor', description: 'Temp/Humidity Sensor' } },
      ];
      const defaultEdges = [
        { id: crypto.randomUUID(), source: defaultNodes[0].id, target: defaultNodes[1].id, label: 'Power', animated: true },
        { id: crypto.randomUUID(), source: defaultNodes[0].id, target: defaultNodes[2].id, label: 'SPI', animated: true },
        { id: crypto.randomUUID(), source: defaultNodes[0].id, target: defaultNodes[3].id, label: 'I2C', animated: true },
      ];
      setNodes(defaultNodes);
      setEdges(defaultEdges);
      setActiveView('architecture');
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
        id: crypto.randomUUID(),
        type: 'custom' as const,
        position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
        data: { label: nodeName, type: nodeType, description: `${nodeType.toUpperCase()} component` },
      };
      setNodes([...nodes, newNode]);
      setActiveView('architecture');
      addToHistory(`Added ${nodeType} node: ${nodeName}`, 'AI');
      addOutputLog(`[AI] Added ${nodeType} node: ${nodeName}`);
      return `[ACTION] Added new ${nodeType.toUpperCase()} node '${nodeName}' to the architecture.\n\nI've placed it on the canvas. You can drag it to reposition, then connect it to other components.`;
    }

    if ((lower.includes('remove') || lower.includes('delete')) && (lower.includes('node') || lower.includes('component'))) {
      const nameMatch = lower.match(/(?:remove|delete)\s+(?:node|component)\s+(.+)/);
      if (nameMatch) {
        const targetName = nameMatch[1].trim();
        const nodeToRemove = nodes.find((n) => nodeData(n).label.toLowerCase().includes(targetName));
        if (nodeToRemove) {
          setNodes(nodes.filter((n) => n.id !== nodeToRemove.id));
          setEdges(edges.filter((e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id));
          addToHistory(`Removed node: ${nodeData(nodeToRemove).label}`, 'AI');
          addOutputLog(`[AI] Removed node: ${nodeData(nodeToRemove).label}`);
          return `[ACTION] Removed node '${nodeData(nodeToRemove).label}' and its connections from the architecture.`;
        }
        return `Could not find a node matching '${targetName}'. Available nodes: ${nodes.map((n) => nodeData(n).label).join(', ') || 'none'}.`;
      }
    }

    if (lower.includes('connect') && lower.includes(' to ')) {
      const connectMatch = lower.match(/connect\s+(.+?)\s+to\s+(.+)/);
      if (connectMatch) {
        const sourceName = connectMatch[1].trim();
        const targetName = connectMatch[2].trim();
        const sourceNode = nodes.find((n) => nodeData(n).label.toLowerCase().includes(sourceName));
        const targetNode = nodes.find((n) => nodeData(n).label.toLowerCase().includes(targetName));
        if (sourceNode && targetNode) {
          const newEdge = {
            id: crypto.randomUUID(),
            source: sourceNode.id,
            target: targetNode.id,
            label: 'Data',
            animated: true,
          };
          setEdges([...edges, newEdge]);
          addToHistory(`Connected ${nodeData(sourceNode).label} to ${nodeData(targetNode).label}`, 'AI');
          addOutputLog(`[AI] Connected ${nodeData(sourceNode).label} → ${nodeData(targetNode).label}`);
          return `[ACTION] Connected '${nodeData(sourceNode).label}' to '${nodeData(targetNode).label}'.\n\nA data bus has been created between the two components.`;
        }
        return `Could not find one or both nodes. Available nodes: ${nodes.map((n) => nodeData(n).label).join(', ') || 'none'}.`;
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
        const bomItem = bom.find((b) => b.partNumber.toLowerCase().includes(partName) || b.description.toLowerCase().includes(partName));
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
      const rows = bom.map((item) => [item.partNumber, item.manufacturer, item.description, item.quantity, item.unitPrice, item.totalPrice, item.supplier, item.status]);
      try {
        const csv = buildCSV(headers, rows);
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `${projectName}_BOM.csv`);
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
      issues.forEach((issue) => deleteValidationIssue(issue.id));
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
      return `**Project Summary**\n\n• **Name:** ${projectName}\n• **Description:** ${projectDescription}\n• **Architecture Nodes:** ${nodes.length}\n• **Connections:** ${edges.length}\n• **BOM Items:** ${bom.length}\n• **Validation Issues:** ${issues.length}\n• **Active View:** ${activeView}`;
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
  }, [nodes, edges, bom, issues, projectName, projectDescription, setNodes, setEdges, setActiveView, addToHistory, addOutputLog, addBomItem, deleteBomItem, runValidation, deleteValidationIssue, setProjectName, setProjectDescription]);

  const executeAIActions = useActionExecutor();


  const toggleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addOutputLog('[SYSTEM] Voice input not supported in this browser');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    /* eslint-disable @typescript-eslint/no-explicit-any -- Web Speech API types unavailable in all TS envs */
    const win = window as Record<string, unknown>;
    const SpeechRecognitionCtor = (win.webkitSpeechRecognition || win.SpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    }) | undefined;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev: string) => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening, addOutputLog]);

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
      id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
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
          projectId,
          temperature: aiTemperature,
          customSystemPrompt,
          activeView,
          activeSheetId,
          selectedNodeId,
          changeDiff,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let finalActions: AIAction[] = [];

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

      const hasDestructive = finalActions.some((a) => DESTRUCTIVE_ACTIONS.includes(a.type));
      const msgId = crypto.randomUUID();

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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === 'AbortError') {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Request was cancelled.',
          timestamp: Date.now(),
        });
      } else {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to communicate with AI. Check your settings.'}`,
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
  }, [input, aiApiKey, aiProvider, aiModel, aiTemperature, customSystemPrompt, activeView, activeSheetId, addMessage, setIsGenerating, executeAIActions, processLocalCommand, selectedNodeId, getChangeDiff, captureSnapshot, projectId]);

  const handleRegenerate = useCallback(() => {
    if (lastUserMessage && !isGenerating) {
      handleSend(lastUserMessage);
    }
  }, [lastUserMessage, isGenerating, handleSend]);

  const exportChat = useCallback(() => {
    try {
      const text = messages.map((m) =>
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



  const followUpSuggestions = useMemo((): string[] => {
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
      id: crypto.randomUUID(),
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
          <ChatHeader
            onSearch={() => setShowSearch(!showSearch)}
            onExport={exportChat}
            onSettings={() => setShowSettings(!showSettings)}
            onClose={onClose}
            showSearch={showSearch}
            showSettings={showSettings}
          />

          <ChatSearchBar
            value={chatSearch}
            onChange={setChatSearch}
            visible={showSearch}
          />

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
              <div className="flex-1 overflow-y-auto p-4 relative" ref={scrollRef}>
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

                {filteredMessages.length > 0 && (
                  <div style={{ height: `${messageVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {messageVirtualizer.getVirtualItems().map((virtualRow) => {
                      const msg = filteredMessages[virtualRow.index];
                      return (
                        <div
                          key={msg.id}
                          ref={messageVirtualizer.measureElement}
                          data-index={virtualRow.index}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            paddingBottom: '16px',
                          }}
                        >
                          <MessageBubble
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
                        </div>
                      );
                    })}
                  </div>
                )}

                {isGenerating && (
                  <StreamingIndicator content={streamingContent} onCancel={cancelRequest} />
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

              <FollowUpSuggestions
                suggestions={followUpSuggestions}
                onSuggest={handleSend}
                isGenerating={isGenerating}
                hasPendingActions={!!pendingActions}
              />
            </>
          )}

          <MessageInput
            input={input}
            onInputChange={setInput}
            onSend={() => handleSend()}
            onQuickAction={handleSend}
            isGenerating={isGenerating}
            onToggleQuickActions={() => setShowQuickActions(!showQuickActions)}
            showQuickActions={showQuickActions}
            onVoiceToggle={toggleVoiceInput}
            isListening={isListening}
            aiProvider={aiProvider}
            aiModel={aiModel}
            apiKeyValid={apiKeyValid()}
            aiApiKey={aiApiKey}
            onFileUpload={(file) => {
              addOutputLog(`[SYSTEM] Image attached: ${file.name}`);
              addToHistory(`Uploaded image: ${file.name}`, 'User');
            }}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
          />
        </div>
      </div>
    </>
  );
}
