import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChatPanel() {
  const { messages, addMessage } = useProject();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      timestamp: Date.now()
    });

    setIsLoading(true);

    // Mock AI Response with delay
    setTimeout(() => {
      let response = "I've analyzed your request.";
      
      if (userMsg.toLowerCase().includes('power')) {
        response = "I recommend adding a 10uF ceramic capacitor near the power pin for stability. Would you like me to update the BOM?";
      } else if (userMsg.toLowerCase().includes('connect')) {
        response = "I've connected the SPI lines between the MCU and the LoRa module. Check the Architecture view.";
      } else if (userMsg.toLowerCase().includes('generate')) {
        response = "Generating a basic block diagram for an IoT Sensor node...";
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-80 shadow-2xl z-20">
      <div className="p-4 border-b border-border bg-muted/20 backdrop-blur flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold tracking-wider text-sm">ProtoPulse AI</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex gap-3 text-sm",
            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
              msg.role === 'user' ? "bg-muted text-foreground border-border" : "bg-primary/10 text-primary border-primary/20"
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "p-3 rounded-lg max-w-[85%]",
              msg.role === 'user' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 border border-border text-foreground"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 text-sm">
             <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-primary/10 text-primary border-primary/20">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-muted/50 border border-border text-foreground p-3 rounded-lg flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask ProtoPulse AI..."
            className="bg-muted/30 border-border focus:border-primary"
          />
          <Button size="icon" onClick={handleSend} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
