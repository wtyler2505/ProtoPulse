import { CompletionContext, CompletionResult, Completion, autocompletion } from '@codemirror/autocomplete';
import { hoverTooltip, Tooltip } from '@codemirror/view';
import type { PinConstant } from '@shared/arduino-pin-generator';

const ARDUINO_BUILTINS: Completion[] = [
  { label: 'pinMode', type: 'function', info: '(pin, mode)', detail: 'Configures the specified pin to behave either as an input or an output.' },
  { label: 'digitalWrite', type: 'function', info: '(pin, val)', detail: 'Write a HIGH or a LOW value to a digital pin.' },
  { label: 'digitalRead', type: 'function', info: '(pin)', detail: 'Reads the value from a specified digital pin, either HIGH or LOW.' },
  { label: 'analogRead', type: 'function', info: '(pin)', detail: 'Reads the value from the specified analog pin.' },
  { label: 'analogWrite', type: 'function', info: '(pin, val)', detail: 'Writes an analog value (PWM wave) to a pin.' },
  { label: 'delay', type: 'function', info: '(ms)', detail: 'Pauses the program for the amount of time (in milliseconds).' },
  { label: 'delayMicroseconds', type: 'function', info: '(us)', detail: 'Pauses the program for the amount of time (in microseconds).' },
  { label: 'millis', type: 'function', info: '()', detail: 'Returns the number of milliseconds passed since the Arduino board began running the current program.' },
  { label: 'micros', type: 'function', info: '()', detail: 'Returns the number of microseconds since the Arduino board began running the current program.' },
  { label: 'Serial.begin', type: 'function', info: '(speed)', detail: 'Sets the data rate in bits per second (baud) for serial data transmission.' },
  { label: 'Serial.print', type: 'function', info: '(val)', detail: 'Prints data to the serial port as human-readable ASCII text.' },
  { label: 'Serial.println', type: 'function', info: '(val)', detail: 'Prints data to the serial port as human-readable ASCII text followed by a carriage return character and a newline character.' },
  { label: 'Serial.available', type: 'function', info: '()', detail: 'Get the number of bytes (characters) available for reading from the serial port.' },
  { label: 'Serial.read', type: 'function', info: '()', detail: 'Reads incoming serial data.' },
  
  // Constants
  { label: 'HIGH', type: 'constant', detail: 'Digital pin high state (usually 5V or 3.3V)' },
  { label: 'LOW', type: 'constant', detail: 'Digital pin low state (0V)' },
  { label: 'INPUT', type: 'constant', detail: 'Configure pin as input' },
  { label: 'OUTPUT', type: 'constant', detail: 'Configure pin as output' },
  { label: 'INPUT_PULLUP', type: 'constant', detail: 'Configure pin as input with internal pull-up resistor' },
];

export function createArduinoAutocompletion(pins: PinConstant[]) {
  // Map schematic pins to completions
  const pinCompletions: Completion[] = pins.map(pin => ({
    label: pin.name,
    type: 'variable',
    info: `Pin ${pin.pinNumber}`,
    detail: `Connected to ${pin.componentName} (${pin.netName})`,
    boost: 2 // Boost project-specific pins to the top
  }));

  const completions = [...pinCompletions, ...ARDUINO_BUILTINS];

  function arduinoCompletions(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    
    // Also support dot-completion for Serial
    const dotMatch = context.matchBefore(/Serial\.\w*/);
    if (dotMatch) {
      return {
        from: dotMatch.from,
        options: completions.filter(c => c.label.startsWith('Serial.')),
      };
    }

    return {
      from: word.from,
      options: completions,
      validFor: /^\w*$/
    };
  }

  // Define hover tooltip for "Go to definition" preview
  const pinHoverTooltip = hoverTooltip((view, pos, side) => {
    const { from, to, text } = view.state.doc.lineAt(pos);
    let start = pos, end = pos;
    while (start > from && /\\w/.test(text[start - 1 - from])) start--;
    while (end < to && /\\w/.test(text[end - from])) end++;
    if (start === pos && side < 0 || start === end) return null;
    
    const word = text.slice(start - from, end - from);
    const pin = pins.find(p => p.name === word);
    if (!pin) return null;

    return {
      pos: start,
      end,
      above: true,
      create(view) {
        const dom = document.createElement("div");
        dom.className = "p-2 bg-background border border-border shadow-md rounded-md text-xs font-mono text-foreground";
        dom.innerHTML = `<div class="font-bold text-primary mb-1">#define ${pin.name} ${pin.pinNumber}</div>
                       <div class="text-muted-foreground">Connected to: ${pin.componentName}</div>
                       <div class="text-muted-foreground">Net: ${pin.netName}</div>`;
        return { dom };
      }
    };
  });

  return [
    autocompletion({ override: [arduinoCompletions] }),
    pinHoverTooltip
  ];
}