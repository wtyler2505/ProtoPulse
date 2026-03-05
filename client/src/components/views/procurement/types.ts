import type { BomItem } from '@/lib/project-context';
import type { AssemblyCategory } from './bom-utils';

export type EnrichedBomItem = BomItem & { _isEsd: boolean; _assemblyCategory: AssemblyCategory | null };

export interface EditValues {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
}
