import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Image as ImageIcon, Video, Mic, Plus, Zap, X } from 'lucide-react';
import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
}

export default function ChatPanel({ isOpen, onClose, collapsed = false, width = 350 }: ChatPanelProps) {
  const { messages, addMessage, isGenerating, setIsGenerating, runValidation, setNodes, setEdges } = useProject();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'chat' | 'image' | 'video'>('chat');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

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

    setTimeout(() => {
      let response = "I've analyzed your design and everything looks good. Let me know if you'd like me to review specific subsystems.";
      const lowerMsg = msgText.toLowerCase();

      if (lowerMsg.includes('schematic') || lowerMsg.includes('generate')) {
        response = "I've generated a preliminary block diagram for the agriculture sensor node. It includes the ESP32-S3, LoRa transceiver, and power management units. All connections follow standard bus protocols.";
      } else if (lowerMsg.includes('bom') || lowerMsg.includes('cost') || lowerMsg.includes('optimize')) {
        response = "BOM optimization complete. I found alternative sourcing for 2 components:\n• TP4056 → MCP73831 (saves $0.08/unit, same footprint)\n• USB connector → alternate GCT part (saves $0.12/unit)\nTotal savings: $0.20/unit at 1k qty.";
      } else if (lowerMsg.includes('validate') || lowerMsg.includes('check') || lowerMsg.includes('error')) {
        runValidation();
        response = "Design rule check complete. I've identified potential issues in your design. Switch to the Validation tab to review findings and apply suggested fixes.";
      } else if (lowerMsg.includes('memory') || lowerMsg.includes('ram') || lowerMsg.includes('storage')) {
        response = "For the ESP32-S3, I recommend adding external PSRAM (ESP-PSRAM64H, 8MB). Connect via the dedicated SPI interface on GPIO 33-37. This gives you enough buffer for sensor data logging and OTA update staging.";
      } else if (lowerMsg.includes('power') || lowerMsg.includes('battery')) {
        response = "Power analysis summary:\n• Active mode: ~180mA (Wi-Fi TX)\n• Deep sleep: ~10µA\n• Battery life (2000mAh): ~45 days at 1 reading/hour\nRecommendation: Add a solar cell (5V/500mA) with MPPT for indefinite operation.";
      } else if (lowerMsg.includes('antenna') || lowerMsg.includes('rf')) {
        response = "RF design recommendations:\n• LoRa antenna: Use a spring-type 868/915MHz antenna with SMA connector\n• Match impedance to 50Ω using Pi-network (L=3.3nH, C1=1.5pF, C2=1.8pF)\n• Keep RF trace width at 0.7mm for FR4 substrate (εr=4.6)";
      } else if (lowerMsg.includes('sensor') || lowerMsg.includes('temperature')) {
        response = "Sensor configuration optimized:\n• SHT40: Set to high-precision mode (±0.2°C accuracy)\n• I2C address: 0x44, pull-ups: 4.7kΩ to 3.3V\n• Sample rate: 1Hz recommended for thermal stability\n• Consider adding SHT40-BD1B for extended range (-40°C to +125°C).";
      } else if (lowerMsg.includes('add') || lowerMsg.includes('component')) {
        response = "I can help you add a component. Drag one from the Asset Library on the left, or tell me what type of component you need (MCU, sensor, power, communication, or connector) and I'll suggest specific parts.";
      }

      if (mode === 'image') {
        response = "📐 [Schematic visualization mode] " + response;
      } else if (mode === 'video') {
        response = "🎬 [Simulation mode] " + response;
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
      setIsGenerating(false);
    }, 2000);
  };

  if (collapsed) {
    return null;
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
          "flex flex-col h-full bg-card border-l border-border shadow-2xl relative shrink-0 overflow-hidden",
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
          />
        </div>
      </div>
    </>
  );
}

function ChatContent({
  messages, input, setInput, mode, setMode, isGenerating, handleSend, scrollRef, onClose, showQuickActions, setShowQuickActions
}: any) {
  return (
    <>
      <div className="h-14 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold tracking-wider text-sm">ProtoPulse AI</h3>
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={() => setMode('chat')} className={cn("p-1.5 hover:bg-muted transition-colors", mode === 'chat' && "text-primary bg-primary/10")}>
            <Bot className="w-4 h-4" />
          </button>
          <button onClick={() => setMode('image')} className={cn("p-1.5 hover:bg-muted transition-colors", mode === 'image' && "text-primary bg-primary/10")}>
            <ImageIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setMode('video')} className={cn("p-1.5 hover:bg-muted transition-colors", mode === 'video' && "text-primary bg-primary/10")}>
            <Video className="w-4 h-4" />
          </button>
          <button
            data-testid="chat-close"
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 md:hidden"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

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
                "p-3 leading-relaxed shadow-sm",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted/50 border border-border text-foreground"
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
          {['Generate Schematic', 'Optimize BOM', 'Check Errors', 'Add Memory'].map((action) => (
            <button 
              key={action}
              onClick={() => handleSend(action)}
              className="whitespace-nowrap px-3 py-1.5 bg-muted/40 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3 h-3" />
              {action}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-border bg-card">
        <div className="relative">
          <Input 
            value={input}
            onChange={(e: any) => setInput(e.target.value)}
            onKeyDown={(e: any) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'chat' ? "Describe your system..." : mode === 'image' ? "Upload or describe visual..." : "Describe video context..."}
            className="bg-muted/30 border-border focus:border-primary pr-10 pl-10 py-5 shadow-inner"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowQuickActions(!showQuickActions)} />
          </div>
          <Button 
            size="icon" 
            onClick={() => handleSend()} 
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-[10px] text-center text-muted-foreground/40 mt-2 font-mono">
          ProtoPulse AI v2.4 (Model: CircuitGPT-4o)
        </div>
      </div>
    </>
  );
}
