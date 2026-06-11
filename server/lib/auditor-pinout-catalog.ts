interface AuditorPinCatalogEntry {
  aliases: string[];
  pins: string[];
}

const CATALOG: AuditorPinCatalogEntry[] = [
  {
    aliases: ['esp32', 'esp32-wroom-32', 'esp-wroom-32', 'nodemcu esp32', 'esp32 devkit'],
    pins: ['3V3', 'EN', 'GPIO0', 'GPIO2', 'GPIO4', 'GPIO5', 'GPIO12', 'GPIO13', 'GPIO14', 'GPIO15', 'GPIO16', 'GPIO17', 'GPIO18', 'GPIO19', 'GPIO21', 'GPIO22', 'GPIO23', 'GND'],
  },
  {
    aliases: ['atmega328p', 'atmega328', 'arduino uno mcu'],
    pins: ['VCC', 'AVCC', 'AREF', 'GND', 'RESET', 'PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5', 'PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PD0', 'PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7'],
  },
  {
    aliases: ['ne555', 'lm555', '555 timer'],
    pins: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'],
  },
];

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export function findAuditorPinCatalogPins(nameCandidates: Array<string | null | undefined>): string[] | null {
  const normalized = nameCandidates
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => norm(v));

  for (const candidate of normalized) {
    const hit = CATALOG.find((entry) => entry.aliases.some((alias) => candidate.includes(alias)));
    if (hit) {
      return hit.pins;
    }
  }
  return null;
}

