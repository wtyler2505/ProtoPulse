# TUI Components Reference

ASCII-art style terminal UI components for the cyberpunk aesthetic.

## ASCII Sparkline

```tsx
// components/ui/tui/ASCIISparkline.tsx
const CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

interface ASCIISparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function ASCIISparkline({ 
  data, 
  width = 20, 
  height = 1,
  color = 'text-green-400' 
}: ASCIISparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  // Normalize and map to characters
  const chars = data.slice(-width).map(value => {
    const normalized = (value - min) / range;
    const index = Math.floor(normalized * (CHARS.length - 1));
    return CHARS[index];
  });
  
  return (
    <span className={`font-mono ${color}`}>
      {chars.join('')}
    </span>
  );
}

// Usage
<ASCIISparkline data={[1, 2, 3, 5, 8, 13, 8, 5, 3, 2, 1]} />
// Output: ▁▂▃▄▆█▆▄▃▂▁
```

## ASCII Progress Bar

```tsx
// components/ui/tui/ASCIIProgressBar.tsx
interface ASCIIProgressBarProps {
  value: number;      // 0-100
  width?: number;
  showPercent?: boolean;
  fillChar?: string;
  emptyChar?: string;
}

export function ASCIIProgressBar({
  value,
  width = 20,
  showPercent = true,
  fillChar = '█',
  emptyChar = '░',
}: ASCIIProgressBarProps) {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  
  return (
    <span className="font-mono text-green-400">
      [{fillChar.repeat(filled)}{emptyChar.repeat(empty)}]
      {showPercent && ` ${value.toFixed(0)}%`}
    </span>
  );
}

// Usage
<ASCIIProgressBar value={75} width={20} />
// Output: [███████████████░░░░░] 75%
```

## TUI Panel (Box Drawing)

```tsx
// components/ui/tui/TUIPanel.tsx
interface TUIPanelProps {
  title?: string;
  children: React.ReactNode;
  width?: number;
}

export function TUIPanel({ title, children, width }: TUIPanelProps) {
  return (
    <div className="font-mono text-green-400 whitespace-pre">
      {/* Top border */}
      <div>
        ┌{title ? `─ ${title} ` : ''}{'─'.repeat(width ? width - (title?.length || 0) - 4 : 20)}┐
      </div>
      
      {/* Content */}
      <div className="px-1">
        │ {children}
      </div>
      
      {/* Bottom border */}
      <div>
        └{'─'.repeat(width || 24)}┘
      </div>
    </div>
  );
}

// Usage
<TUIPanel title="Status">
  CPU: 45%
  MEM: 2.1GB
</TUIPanel>

// Output:
// ┌─ Status ────────────┐
// │ CPU: 45%            │
// │ MEM: 2.1GB          │
// └─────────────────────┘
```

## TUI System Monitor

```tsx
// components/ui/tui/TUISystemMonitor.tsx
interface TUISystemMonitorProps {
  cpu: number;
  memory: number;
  temperature: number;
  uptime: string;
}

export function TUISystemMonitor({
  cpu,
  memory,
  temperature,
  uptime,
}: TUISystemMonitorProps) {
  return (
    <div className="font-mono text-green-400 text-xs space-y-1">
      <div className="flex justify-between">
        <span>CPU</span>
        <ASCIIProgressBar value={cpu} width={15} />
      </div>
      <div className="flex justify-between">
        <span>MEM</span>
        <ASCIIProgressBar value={memory} width={15} />
      </div>
      <div className="flex justify-between">
        <span>TMP</span>
        <span className={temperature > 70 ? 'text-red-400' : ''}>
          {temperature}°C
        </span>
      </div>
      <div className="flex justify-between text-gray-500">
        <span>UP</span>
        <span>{uptime}</span>
      </div>
    </div>
  );
}
```

## TUI Compass Indicator

```tsx
// components/ui/tui/TUICompassIndicator.tsx
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

interface TUICompassIndicatorProps {
  heading: number;  // 0-360
}

export function TUICompassIndicator({ heading }: TUICompassIndicatorProps) {
  const index = Math.round(heading / 45) % 8;
  const direction = DIRECTIONS[index];
  
  return (
    <div className="font-mono text-green-400 text-center">
      <div className="text-xs text-gray-500">N</div>
      <div className="text-2xl">
        {direction === 'N' && '↑'}
        {direction === 'NE' && '↗'}
        {direction === 'E' && '→'}
        {direction === 'SE' && '↘'}
        {direction === 'S' && '↓'}
        {direction === 'SW' && '↙'}
        {direction === 'W' && '←'}
        {direction === 'NW' && '↖'}
      </div>
      <div className="text-sm">{heading.toFixed(0)}°</div>
    </div>
  );
}
```

## Box Drawing Characters Reference

```
Single line:
┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼

Double line:
╔ ╗ ╚ ╝ ═ ║ ╠ ╣ ╦ ╩ ╬

Mixed:
╒ ╕ ╘ ╛ ╞ ╡ ╤ ╧ ╪

Rounded:
╭ ╮ ╰ ╯

Block elements:
█ ▓ ▒ ░ ▄ ▀ ▐ ▌

Bar chart:
▁ ▂ ▃ ▄ ▅ ▆ ▇ █

Arrows:
← → ↑ ↓ ↖ ↗ ↘ ↙ ↔ ↕
```
