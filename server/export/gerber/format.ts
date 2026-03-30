// =============================================================================
// Gerber File Header, Footer & Aperture Definition Rendering
// =============================================================================

import type { ApertureDef } from './types';

export interface HeaderOptions {
  comment: string;
  fileFunction: string;
}

export function gerberHeader(opts: HeaderOptions): string {
  const lines: string[] = [];
  lines.push(`G04 ProtoPulse EDA - ${opts.comment}*`);
  lines.push('%FSLAX36Y36*%');
  lines.push('%MOMM*%');
  lines.push('%TF.GenerationSoftware,ProtoPulse,EDA,1.0*%');
  lines.push(`%TF.FileFunction,${opts.fileFunction}*%`);
  lines.push('%TF.FilePolarity,Positive*%');
  return lines.join('\n');
}

export function gerberApertureDefs(defs: ApertureDef[]): string {
  const lines: string[] = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    lines.push(`%ADD${d.code}${d.shape},${d.params}*%`);
  }
  return lines.join('\n');
}

export function gerberFooter(): string {
  return 'M02*';
}
