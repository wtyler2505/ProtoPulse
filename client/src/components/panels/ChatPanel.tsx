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
}

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { messages, addMessage, isGenerating, setIsGenerating, runValidation, setNodes, setEdges } = useProject();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'chat' | 'image' | 'video'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      timestamp: Date.now(),
      mode: mode
    });

    setIsGenerating(true);

    setTimeout(() => {
      let response = "I've processed your request.";
      const lowerMsg = userMsg.toLowerCase();

      if (lowerMsg.includes('schematic') || lowerMsg.includes('generate')) {
        response = "I've generated a preliminary block diagram for the agriculture sensor node. It includes the ESP32-S3, LoRa transceiver, and power management units.";
      } else if (lowerMsg.includes('bom') || lowerMsg.includes('cost')) {
        response = "I've optimized the BOM. Switched the LDO to a lower-cost alternative from Texas Instruments. Total estimated savings: $0.45 per unit.";
      } else if (lowerMsg.includes('validate') || lowerMsg.includes('check')) {
        runValidation();
        response = "Validation complete. I found a potential issue with the RF impedance matching on the LoRa module path.";
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

  return (
    <>
      {isOpen && (
        <div
          data-testid="chat-backdrop"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <div className={cn(
        "flex flex-col h-full bg-card border-l border-border shadow-2xl z-50 relative",
        "fixed inset-y-0 right-0 w-full max-w-[350px] transform transition-transform md:relative md:w-[350px] md:translate-x-0",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
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
               className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden ml-1"
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

          {messages.map((msg) => (
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

        {!isGenerating && messages.length > 0 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
            {['Generate Schematic', 'Optimize BOM', 'Check Errors', 'Add Memory'].map((action) => (
              <button 
                key={action}
                onClick={() => { setInput(action); handleSend(); }}
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={mode === 'chat' ? "Describe your system..." : mode === 'image' ? "Upload or describe visual..." : "Describe video context..."}
              className="bg-muted/30 border-border focus:border-primary pr-10 pl-10 py-5 shadow-inner"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
               <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
            </div>
            <Button 
              size="icon" 
              onClick={handleSend} 
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-[10px] text-center text-muted-foreground/40 mt-2 font-mono">
            ProtoPulse AI v2.4 (Model: CircuitGPT-4o)
          </div>
        </div>
      </div>
    </>
  );
}
