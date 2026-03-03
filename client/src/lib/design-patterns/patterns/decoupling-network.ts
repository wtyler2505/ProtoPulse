import type { DesignPattern } from '../types';

export const decouplingNetwork: DesignPattern = {
  id: 'decoupling-network',
  name: 'Decoupling Network',
  category: 'power',
  difficulty: 'beginner',
  description:
    'Bypass capacitors placed close to an IC\'s power pins that filter high-frequency noise from the supply rail, preventing erratic behavior in digital and analog circuits.',
  whyItWorks:
    'Every IC draws short bursts of current when its internal transistors switch. These current spikes travel through the trace inductance of the power supply wiring, creating voltage droops and high-frequency noise on the VCC rail. A ceramic capacitor placed within a few millimeters of the IC\'s VCC pin acts as a tiny local energy reservoir — it supplies the instantaneous current the IC needs before the main supply can respond. The 100 nF ceramic handles fast (MHz-range) transients, while the 10 \u00B5F electrolytic smooths slower (kHz-range) ripple. Together they form a two-stage filter that keeps the IC\'s supply voltage stable.',
  components: [
    {
      name: 'High-frequency bypass capacitor',
      type: 'Ceramic capacitor (MLCC)',
      value: '100 nF (0.1 \u00B5F)',
      notes: 'X7R or C0G dielectric. Use 0402 or 0603 package for short lead length. One per VCC pin.',
    },
    {
      name: 'Bulk bypass capacitor',
      type: 'Electrolytic or ceramic capacitor',
      value: '10 \u00B5F',
      notes: 'Handles lower-frequency ripple. Can be shared across a few nearby ICs. Aluminum electrolytic or X5R ceramic.',
    },
  ],
  connections: [
    {
      from: '100 nF capacitor terminal 1',
      to: 'IC VCC pin',
      description: 'Connect directly to the IC power pin with the shortest possible trace. Ideally on the same layer, right next to the pin.',
    },
    {
      from: '100 nF capacitor terminal 2',
      to: 'IC GND pin',
      description: 'Connect to the ground pin or ground plane with a short, low-inductance path. Vias directly under the cap pad are ideal.',
    },
    {
      from: '10 \u00B5F capacitor',
      to: 'VCC rail near IC cluster',
      description: 'Place the bulk cap within 10-20 mm of the IC group it serves. It does not need to be as close as the 100 nF caps.',
    },
  ],
  tips: [
    'Every single IC in your design needs at least one 100 nF cap — this is non-negotiable. If the datasheet says "connect bypass capacitor," they mean this.',
    'Place the cap on the same side of the PCB as the IC. Routing through a via to the other side adds inductance and defeats the purpose.',
    'For the rover\'s Arduino Mega and ESP32: both already have decoupling on their modules, but any additional ICs you add (motor drivers, sensors) each need their own.',
    'If an IC has multiple VCC pins (common on microcontrollers), each pin needs its own 100 nF cap.',
    'When debugging "random" resets, glitchy communication, or ADC readings that jump around, missing or poorly placed decoupling caps are the first thing to check.',
  ],
  commonMistakes: [
    'Placing the bypass cap far from the IC — even 1 cm of extra trace adds enough inductance to make the cap ineffective at high frequencies.',
    'Forgetting to decouple every VCC pin — on a 64-pin MCU with 4 VCC pins, you need 4 separate 100 nF caps, not just one.',
    'Using only a large electrolytic without the small ceramic — electrolytics have high ESR and cannot respond to fast transients.',
    'Routing the cap through long traces or vias to reach ground — the ground return path must be as short as the power path.',
  ],
  relatedPatterns: ['voltage-regulator', 'crystal-oscillator'],
  tags: ['bypass', 'decoupling', 'capacitor', 'noise', 'VCC', 'power supply', '100nF', 'filtering', 'MLCC'],
};
