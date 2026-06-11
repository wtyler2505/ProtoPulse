export const PACKAGE_HEIGHTS: Record<string, number> = {
  'DIP-8': 5.0,
  'DIP-14': 5.0,
  'DIP-16': 5.0,
  'DIP-28': 5.0,
  'DIP-40': 5.0,
  'SOIC-8': 1.75,
  'SOIC-14': 1.75,
  'SOIC-16': 1.75,
  'SOT-23': 1.1,
  'SOT-23-5': 1.1,
  'SOT-23-6': 1.1,
  'QFP-44': 1.6,
  'QFP-64': 1.6,
  'QFP-100': 1.6,
  'QFP-144': 1.6,
  'QFN-16': 0.85,
  'QFN-32': 0.85,
  'QFN-48': 0.85,
  'SOP-8': 1.75,
  'TO-220': 4.5,
  'TO-92': 4.5,
  'TO-263': 2.5,
  '0402': 0.5,
  '0603': 0.6,
  '0805': 0.7,
  '1206': 0.8,
  'SOD-123': 1.1,
  'SOD-323': 0.6,
};

export function getPackageHeight(packageType: string, fallback = 2.0): number {
  return PACKAGE_HEIGHTS[packageType] ?? fallback;
}
