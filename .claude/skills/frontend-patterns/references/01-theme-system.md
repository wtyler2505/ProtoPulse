# Theme System Reference

## Cyberpunk Color Palette

```typescript
// Core colors - use these, not arbitrary hex values
const colors = {
  // Primary (Green terminal)
  primary: '#00ff00',           // Bright green - main accent
  primaryDim: '#00cc00',        // Dimmer green - hover states
  primaryMuted: '#00ff0033',    // Green with alpha - backgrounds
  
  // Backgrounds
  background: '#0a0a0a',        // Near black - main bg
  surface: '#1a1a1a',           // Dark gray - cards, panels
  surfaceHover: '#222222',      // Slightly lighter - hover
  
  // Borders
  border: '#333333',            // Default borders
  borderGreen: '#00ff0050',     // Green tinted borders
  
  // Text
  text: '#e0e0e0',              // Primary text
  textMuted: '#888888',         // Secondary text
  textDim: '#666666',           // Disabled text
  
  // Status
  error: '#ff4444',
  warning: '#ffaa00',
  success: '#00ff00',
  info: '#00aaff',
};
```

## Tailwind Class Patterns

### Backgrounds
```tsx
// Main backgrounds
className="bg-black"
className="bg-black bg-opacity-90"
className="bg-gray-900"

// Cards and panels
className="bg-black/50"              // Semi-transparent
className="bg-gray-900/80"           // Dark with slight transparency
className="backdrop-blur-sm"         // Glass effect

// Green tinted
className="bg-green-500/10"          // Subtle green
className="bg-green-500/20"          // More visible green
```

### Borders
```tsx
// Default borders
className="border border-gray-700"
className="border border-gray-600/50"

// Green accents
className="border border-green-500/30"
className="border border-green-400/20"
className="border-l-2 border-green-500"   // Left accent

// Active/focus
className="border-green-400/50"
className="ring-1 ring-green-500/50"
```

### Text
```tsx
// Primary text
className="text-gray-100"
className="text-gray-200"

// Green accent text
className="text-green-400"
className="text-green-500"
className="text-green-500/80"

// Muted/secondary
className="text-gray-400"
className="text-gray-500"
```

### Glow Effects
```tsx
// Box shadows for glow
className="shadow-[0_0_10px_rgba(0,255,0,0.3)]"
className="shadow-[0_0_20px_rgba(0,255,0,0.2)]"
className="shadow-green-500/20"

// Ring for focus glow
className="focus:ring-2 focus:ring-green-500/50"
```

### Hover States
```tsx
// Background hover
className="hover:bg-green-500/10"
className="hover:bg-green-500/20"

// Border hover
className="hover:border-green-400/50"
className="hover:border-green-500"

// Text hover
className="hover:text-green-400"
className="hover:text-green-300"
```

## Component Patterns

### Card
```tsx
<div className="
  bg-black/50 
  border border-green-500/20 
  rounded-lg 
  p-4
  backdrop-blur-sm
">
  <h3 className="text-green-400 font-mono text-sm mb-2">
    Card Title
  </h3>
  <div className="text-gray-300">
    Content
  </div>
</div>
```

### Button Variants
```tsx
// Primary
<button className="
  px-4 py-2 
  bg-green-500/20 
  border border-green-500/50 
  text-green-400 
  hover:bg-green-500/30 
  transition-colors
  font-mono
">
  Primary
</button>

// Secondary (ghost)
<button className="
  px-4 py-2 
  text-gray-400 
  hover:text-green-400 
  hover:bg-green-500/10 
  transition-colors
  font-mono
">
  Secondary
</button>

// Danger
<button className="
  px-4 py-2 
  bg-red-500/20 
  border border-red-500/50 
  text-red-400 
  hover:bg-red-500/30
  font-mono
">
  Danger
</button>
```

### Input
```tsx
<input className="
  w-full 
  bg-black/50 
  border border-green-500/30 
  rounded
  px-3 py-2 
  text-green-400 
  placeholder-gray-600
  focus:border-green-400 
  focus:ring-1 
  focus:ring-green-500/50
  focus:outline-none 
  font-mono
" />
```

### Status Badge
```tsx
const statusColors = {
  online:  'bg-green-500/20 text-green-400 border-green-500/50',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  error:   'bg-red-500/20 text-red-400 border-red-500/50',
};

<span className={`
  px-2 py-0.5 
  rounded 
  text-xs 
  border 
  font-mono
  ${statusColors[status]}
`}>
  {status}
</span>
```
