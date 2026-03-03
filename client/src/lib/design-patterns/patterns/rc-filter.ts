import type { DesignPattern } from '../types';

export const rcFilter: DesignPattern = {
  id: 'rc-filter',
  name: 'RC Filter',
  category: 'signal',
  difficulty: 'beginner',
  description:
    'A resistor and capacitor that form a frequency-selective filter — low-pass to smooth noisy signals or high-pass to block DC offsets. The simplest analog filter and the building block of signal conditioning.',
  whyItWorks:
    'A capacitor\'s impedance decreases as frequency increases (Xc = 1/(2\u03C0fC)). In a low-pass configuration, the capacitor is placed in parallel with the output: at low frequencies the capacitor is essentially an open circuit and the signal passes through, but at high frequencies the capacitor shorts the signal to ground. The cutoff frequency where the signal is attenuated by 3 dB (half power) is f = 1/(2\u03C0RC). Swapping the positions of R and C creates a high-pass filter that blocks low frequencies (including DC) and passes high frequencies. Above or below the cutoff, the signal rolls off at 20 dB per decade — a gentle slope that can be steepened by cascading multiple stages.',
  components: [
    {
      name: 'Resistor',
      type: 'Resistor',
      value: '1 k\u03A9 to 100 k\u03A9 (depends on cutoff frequency)',
      notes: 'Use 1% tolerance for accurate cutoff frequency. Lower values load the source more but are less susceptible to noise.',
    },
    {
      name: 'Capacitor',
      type: 'Ceramic capacitor',
      value: '100 pF to 10 \u00B5F (depends on cutoff frequency)',
      notes: 'Use C0G/NP0 for precision applications. X7R is acceptable for general filtering. Avoid Y5V — its capacitance varies wildly with voltage and temperature.',
    },
  ],
  connections: [
    {
      from: 'Input signal',
      to: 'Resistor terminal 1',
      description: 'The signal to be filtered enters through the resistor.',
    },
    {
      from: 'Resistor terminal 2',
      to: 'Output node + capacitor terminal 1 (low-pass)',
      description: 'For a low-pass filter: the output is taken at the junction of R and C. The capacitor connects from this node to ground.',
    },
    {
      from: 'Capacitor terminal 2',
      to: 'Ground (GND)',
      description: 'The capacitor\'s other terminal connects to circuit ground, completing the filter.',
    },
  ],
  tips: [
    'For cleaning up ADC readings on the rover: a 10 k\u03A9 resistor + 100 nF capacitor gives a ~160 Hz cutoff — it passes the slow sensor signals but blocks PWM motor noise.',
    'To find component values for a target frequency: pick R first (1k-100k range), then C = 1/(2\u03C0 \u00D7 R \u00D7 f_cutoff).',
    'For audio noise filtering: use 10 k\u03A9 + 1 nF for a ~16 kHz low-pass (removes ultrasonic noise while preserving audio).',
    'Cascading two identical RC stages doubles the rolloff to 40 dB/decade but shifts the effective -3dB point — multiply the cutoff frequency by 0.64 per additional stage.',
    'Add a buffer (op-amp voltage follower) after the filter if the next stage has low input impedance — otherwise the load changes the effective cutoff frequency.',
  ],
  commonMistakes: [
    'Forgetting that an RC filter has a gentle 20 dB/decade slope — if you need sharp frequency cutoff (e.g., anti-aliasing before an ADC), you need a higher-order active filter, not just one RC stage.',
    'Loading the filter output with a low-impedance circuit — the load forms a voltage divider with R, reducing the signal and shifting the cutoff frequency.',
    'Choosing a cutoff frequency too close to the signal frequency — you will attenuate the desired signal along with the noise. Leave at least a 10\u00D7 margin between the signal bandwidth and the noise frequency.',
  ],
  relatedPatterns: ['voltage-divider', 'decoupling-network'],
  tags: ['RC filter', 'low-pass', 'high-pass', 'cutoff', 'frequency', 'capacitor', 'resistor', 'signal conditioning', 'noise', 'ADC'],
};
