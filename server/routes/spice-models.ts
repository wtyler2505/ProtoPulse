import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertSpiceModelSchema, type InsertSpiceModel } from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';
import { parseImportFile, validateImportFilename, validateImportSize } from '../spice-import';

const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function registerSpiceModelRoutes(app: Express): void {
  // List SPICE models with optional filtering
  app.get(
    '/api/spice-models',
    asyncHandler(async (req, res) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const { category, search, limit, offset } = parsed.data;
      const result = await storage.getSpiceModels({ category, search, limit, offset });
      res.json(result);
    }),
  );

  // Get a single SPICE model by ID
  app.get(
    '/api/spice-models/:id',
    asyncHandler(async (req, res) => {
      const id = parseIdParam(req.params.id);
      const model = await storage.getSpiceModel(id);
      if (!model) {
        return res.status(404).json({ message: 'SPICE model not found' });
      }
      res.json(model);
    }),
  );

  // Create a new SPICE model
  app.post(
    '/api/spice-models',
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
      const parsed = insertSpiceModelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const model = await storage.createSpiceModel(parsed.data);
      res.status(201).json(model);
    }),
  );

  // Seed standard SPICE models
  app.post(
    '/api/spice-models/seed',
    asyncHandler(async (req, res) => {
      const seeded = await seedStandardSpiceModels();
      res.status(201).json({ message: `Seeded ${seeded.length} SPICE models`, count: seeded.length });
    }),
  );

  // Import SPICE (.lib/.mod) or IBIS (.ibs) model files
  // Accepts application/octet-stream body with filename in X-Filename header or ?filename= query param.
  // Also accepts text/plain body for convenience.
  app.post(
    '/api/spice-models/import',
    payloadLimit(5 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      // Extract filename from header or query
      const filename =
        (req.headers['x-filename'] as string | undefined) ??
        (req.query['filename'] as string | undefined) ??
        '';

      if (!filename) {
        return res.status(400).json({ message: 'Missing filename. Provide X-Filename header or ?filename= query parameter.' });
      }

      // Validate file extension
      const extValidation = validateImportFilename(filename);
      if (!extValidation.valid) {
        return res.status(400).json({ message: extValidation.error });
      }

      // Get file content from request body
      let content: string;
      if (Buffer.isBuffer(req.body)) {
        content = req.body.toString('utf-8');
      } else if (typeof req.body === 'string') {
        content = req.body;
      } else {
        return res.status(400).json({
          message: 'Request body must be the file content. Use Content-Type: application/octet-stream or text/plain.',
        });
      }

      // Validate size
      const sizeValidation = validateImportSize(Buffer.byteLength(content, 'utf-8'));
      if (!sizeValidation.valid) {
        return res.status(413).json({ message: sizeValidation.error });
      }

      // Parse the file
      const { models: parsedModels, errors } = parseImportFile(content, filename);

      if (parsedModels.length === 0 && errors.length > 0) {
        return res.status(422).json({ imported: 0, models: [], errors });
      }

      // Validate each parsed model against the schema and store valid ones
      const imported: { name: string; id: number }[] = [];
      for (const parsed of parsedModels) {
        const insertData = {
          name: parsed.name,
          modelType: parsed.modelType,
          spiceDirective: parsed.spiceDirective,
          parameters: parsed.parameters,
          description: parsed.description,
          category: parsed.category,
          datasheet: null,
        };

        const validation = insertSpiceModelSchema.safeParse(insertData);
        if (!validation.success) {
          errors.push(`Model "${parsed.name}": ${fromZodError(validation.error).toString()}`);
          continue;
        }

        const created = await storage.createSpiceModel(validation.data);
        imported.push({ name: created.name, id: created.id });
      }

      res.status(201).json({
        imported: imported.length,
        models: imported,
        errors,
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Standard SPICE model seed data (~20 common components)
// ---------------------------------------------------------------------------

interface SeedModel {
  name: string;
  modelType: string;
  spiceDirective: string;
  parameters: Record<string, number | string>;
  description: string;
  category: string;
  datasheet: string | null;
}

const STANDARD_MODELS: SeedModel[] = [
  // --- Transistors (BJT) ---
  {
    name: '2N2222',
    modelType: 'NPN',
    spiceDirective: '.MODEL 2N2222 NPN(IS=14.34E-15 BF=255.9 NF=1.0 VAF=74.03 IKF=0.2847 ISE=14.34E-12 NE=1.307 BR=6.092 NR=1.0 VAR=28.0 IKR=0.0 ISC=0.0 NC=2.0 RB=10.0 IRB=0.0 RBM=10.0 RE=0.0 RC=1.0 CJE=22.01E-12 VJE=0.7 MJE=0.377 TF=411.1E-12 XTF=3.0 VTF=1.7 ITF=0.6 PTF=0.0 CJC=7.306E-12 VJC=0.75 MJC=0.3416 XCJC=1.0 TR=46.91E-9 CJS=0.0 VJS=0.75 MJS=0.333 XTB=1.5 EG=1.11 XTI=3.0 KF=0.0 AF=1.0 FC=0.5)',
    parameters: { IS: 14.34e-15, BF: 255.9, VAF: 74.03, IKF: 0.2847, RB: 10, RC: 1, CJE: 22.01e-12, CJC: 7.306e-12 },
    description: 'General-purpose NPN transistor, TO-92 package. Widely used in switching and amplification circuits.',
    category: 'transistor',
    datasheet: 'https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf',
  },
  {
    name: '2N3904',
    modelType: 'NPN',
    spiceDirective: '.MODEL 2N3904 NPN(IS=6.734E-15 BF=416.4 NF=1.0 VAF=74.03 IKF=0.06678 ISE=6.734E-12 NE=1.259 BR=0.7389 NR=1.0 VAR=28.0 IKR=0.0 ISC=0.0 NC=2.0 RB=10.0 RE=0.0 RC=1.0 CJE=3.638E-12 VJE=0.65 MJE=0.3085 TF=301.2E-12 XTF=2.0 VTF=1.0 ITF=0.4 CJC=4.493E-12 VJC=0.7 MJC=0.3174 TR=239.5E-9 XTB=1.5 EG=1.11 XTI=3.0)',
    parameters: { IS: 6.734e-15, BF: 416.4, VAF: 74.03, RB: 10, RC: 1, CJE: 3.638e-12, CJC: 4.493e-12 },
    description: 'General-purpose NPN transistor for low-power switching and amplification. Ic max 200mA.',
    category: 'transistor',
    datasheet: 'https://www.onsemi.com/pdf/datasheet/2n3903-d.pdf',
  },
  {
    name: '2N3906',
    modelType: 'PNP',
    spiceDirective: '.MODEL 2N3906 PNP(IS=1.41E-15 BF=180.7 NF=1.0 VAF=18.7 IKF=0.0811 ISE=0.0 NE=1.5 BR=4.977 NR=1.0 VAR=28.0 RC=2.5 CJE=4.64E-12 VJE=0.632 MJE=0.369 TF=301.2E-12 CJC=3.638E-12 VJC=0.7 MJC=0.3174 TR=239.5E-9 XTB=1.5 EG=1.11 XTI=3.0)',
    parameters: { IS: 1.41e-15, BF: 180.7, VAF: 18.7, RC: 2.5, CJE: 4.64e-12, CJC: 3.638e-12 },
    description: 'General-purpose PNP transistor, complement to 2N3904. Ic max 200mA.',
    category: 'transistor',
    datasheet: 'https://www.onsemi.com/pdf/datasheet/2n3906-d.pdf',
  },
  {
    name: 'BC547',
    modelType: 'NPN',
    spiceDirective: '.MODEL BC547 NPN(IS=1.8E-14 BF=400 NF=0.9955 VAF=80 IKF=0.14 ISE=5.0E-14 NE=1.46 BR=35.5 NR=1.005 VAR=12.5 IKR=0.03 ISC=1.72E-13 NC=1.27 RB=0.56 RE=0.6 RC=0.25 CJE=1.3E-11 VJE=0.58 MJE=0.26 CJC=4.0E-12 VJC=0.7 MJC=0.23 TF=4.0E-10 TR=2.1E-8 XTB=1.5 EG=1.11 XTI=3.0)',
    parameters: { IS: 1.8e-14, BF: 400, VAF: 80, RB: 0.56, RE: 0.6, RC: 0.25, CJE: 1.3e-11, CJC: 4.0e-12 },
    description: 'Low-noise NPN transistor, widely used in European designs. Ic max 100mA, hFE 110-800.',
    category: 'transistor',
    datasheet: null,
  },

  // --- MOSFETs ---
  {
    name: '2N7000',
    modelType: 'MOSFET_N',
    spiceDirective: '.MODEL 2N7000 NMOS(LEVEL=1 VTO=1.77 KP=0.15 GAMMA=1.58 PHI=0.65 LAMBDA=0.0067 CBD=35E-12 CBS=40E-12 PB=0.8 IS=1E-14 RD=5.0 RS=1.5 RG=4.7 CGSO=6.24E-10 CGDO=1.07E-10)',
    parameters: { VTO: 1.77, KP: 0.15, LAMBDA: 0.0067, RD: 5, RS: 1.5, RG: 4.7 },
    description: 'Small-signal N-channel enhancement MOSFET. Vds max 60V, Id max 200mA. TO-92 package.',
    category: 'mosfet',
    datasheet: 'https://www.onsemi.com/pdf/datasheet/2n7000-d.pdf',
  },
  {
    name: 'IRF540N',
    modelType: 'MOSFET_N',
    spiceDirective: '.MODEL IRF540N NMOS(LEVEL=1 VTO=4.0 KP=20.43 LAMBDA=0.001 CBD=1.46E-9 CBS=1.89E-9 PB=0.8 IS=1E-14 RD=0.01 RS=0.04 RG=1.2 CGSO=4.82E-9 CGDO=3.28E-10)',
    parameters: { VTO: 4.0, KP: 20.43, LAMBDA: 0.001, RD: 0.01, RS: 0.04 },
    description: 'Power N-channel MOSFET. Vds max 100V, Id max 33A, Rds(on) 44mOhm. TO-220 package.',
    category: 'mosfet',
    datasheet: null,
  },

  // --- Diodes ---
  {
    name: '1N4148',
    modelType: 'DIODE',
    spiceDirective: '.MODEL 1N4148 D(IS=2.52E-9 RS=0.568 N=1.752 BV=100 IBV=100E-6 CJO=4E-12 VJ=0.7 M=0.45 TT=6.0E-9)',
    parameters: { IS: 2.52e-9, RS: 0.568, N: 1.752, BV: 100, CJO: 4e-12, TT: 6e-9 },
    description: 'High-speed switching diode. Vr max 100V, If max 200mA, trr 4ns. DO-35 glass package.',
    category: 'diode',
    datasheet: 'https://www.vishay.com/docs/81857/1n4148.pdf',
  },
  {
    name: '1N4001',
    modelType: 'DIODE',
    spiceDirective: '.MODEL 1N4001 D(IS=14.11E-9 RS=13.5E-3 N=1.984 BV=50 IBV=5E-6 CJO=25.89E-12 VJ=0.3245 M=0.44 TT=5.758E-6)',
    parameters: { IS: 14.11e-9, RS: 13.5e-3, N: 1.984, BV: 50, CJO: 25.89e-12, TT: 5.758e-6 },
    description: 'General-purpose rectifier diode. Vr max 50V, If max 1A, Vf 1.1V. DO-41 package.',
    category: 'diode',
    datasheet: null,
  },
  {
    name: '1N4007',
    modelType: 'DIODE',
    spiceDirective: '.MODEL 1N4007 D(IS=7.02E-9 RS=42E-3 N=1.45 BV=1000 IBV=5E-6 CJO=18.7E-12 VJ=0.3245 M=0.44 TT=5.758E-6)',
    parameters: { IS: 7.02e-9, RS: 42e-3, N: 1.45, BV: 1000, CJO: 18.7e-12, TT: 5.758e-6 },
    description: 'General-purpose rectifier diode. Vr max 1000V, If max 1A. DO-41 package.',
    category: 'diode',
    datasheet: null,
  },
  {
    name: '1N5819',
    modelType: 'SCHOTTKY',
    spiceDirective: '.MODEL 1N5819 D(IS=3.18E-8 RS=0.052 N=1.04 BV=40 IBV=1E-3 CJO=110E-12 VJ=0.34 M=0.37 TT=5E-9)',
    parameters: { IS: 3.18e-8, RS: 0.052, N: 1.04, BV: 40, CJO: 110e-12, TT: 5e-9 },
    description: 'Schottky barrier rectifier. Vr max 40V, If max 1A, Vf 0.6V. Low forward voltage drop.',
    category: 'diode',
    datasheet: null,
  },
  {
    name: '1N5231',
    modelType: 'ZENER',
    spiceDirective: '.MODEL 1N5231 D(IS=1.004E-11 RS=19.03 N=1.044 BV=5.1 IBV=49.02E-3 CJO=200E-12 VJ=0.7 M=0.5)',
    parameters: { IS: 1.004e-11, RS: 19.03, N: 1.044, BV: 5.1, IBV: 49.02e-3, CJO: 200e-12 },
    description: 'Zener diode, 5.1V. Used for voltage regulation and reference circuits.',
    category: 'diode',
    datasheet: null,
  },
  {
    name: '1N5242',
    modelType: 'ZENER',
    spiceDirective: '.MODEL 1N5242 D(IS=3.698E-15 RS=9.338 N=1.0 BV=12.0 IBV=20.83E-3 CJO=55E-12 VJ=0.7 M=0.5)',
    parameters: { IS: 3.698e-15, RS: 9.338, BV: 12.0, IBV: 20.83e-3, CJO: 55e-12 },
    description: 'Zener diode, 12V. Common voltage reference for power supply circuits.',
    category: 'diode',
    datasheet: null,
  },

  // --- Op-amps (subcircuits) ---
  {
    name: 'LM741',
    modelType: 'OPAMP',
    spiceDirective: [
      '.SUBCKT LM741 IN+ IN- VCC VEE OUT',
      'RI IN+ IN- 2E6',
      'E1 1 0 IN+ IN- 200000',
      'RO 1 OUT 75',
      'CO OUT 0 20P',
      'RP VCC VEE 15.15K',
      '.ENDS LM741',
    ].join('\n'),
    parameters: { Aol: 200000, Rin: 2e6, Rout: 75, GBW: 1e6, SR: 0.5 },
    description: 'Classic general-purpose operational amplifier. Open-loop gain 200V/mV, GBW 1MHz, slew rate 0.5V/us.',
    category: 'opamp',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm741.pdf',
  },
  {
    name: 'LM358',
    modelType: 'OPAMP',
    spiceDirective: [
      '.SUBCKT LM358 IN+ IN- VCC VEE OUT',
      'RI IN+ IN- 1E6',
      'E1 1 0 IN+ IN- 100000',
      'RO 1 OUT 150',
      'CO OUT 0 30P',
      'RP VCC VEE 20K',
      '.ENDS LM358',
    ].join('\n'),
    parameters: { Aol: 100000, Rin: 1e6, Rout: 150, GBW: 700e3 },
    description: 'Dual op-amp, single or dual supply operation. Gain 100V/mV, GBW 700kHz. Popular in battery-powered designs.',
    category: 'opamp',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm358.pdf',
  },
  {
    name: 'TL072',
    modelType: 'OPAMP',
    spiceDirective: [
      '.SUBCKT TL072 IN+ IN- VCC VEE OUT',
      'RI IN+ IN- 1E12',
      'E1 1 0 IN+ IN- 200000',
      'RO 1 OUT 100',
      'CO OUT 0 10P',
      'RP VCC VEE 12.5K',
      '.ENDS TL072',
    ].join('\n'),
    parameters: { Aol: 200000, Rin: 1e12, Rout: 100, GBW: 3e6, SR: 13 },
    description: 'Low-noise JFET-input dual op-amp. GBW 3MHz, slew rate 13V/us. Popular in audio circuits.',
    category: 'opamp',
    datasheet: 'https://www.ti.com/lit/ds/symlink/tl072.pdf',
  },

  // --- Voltage Regulators (subcircuits) ---
  {
    name: 'LM7805',
    modelType: 'VOLTAGE_REG',
    spiceDirective: [
      '.SUBCKT LM7805 IN GND OUT',
      'RI IN GND 20K',
      'XOP IN GND OUT VREGOP',
      '.MODEL VREGOP NMOS(VTO=5.0 KP=0.5)',
      '.ENDS LM7805',
    ].join('\n'),
    parameters: { Vout: 5.0, Vin_min: 7.0, Vin_max: 35.0, Iout_max: 1.5, dropout: 2.0 },
    description: 'Positive 5V fixed linear voltage regulator. Input 7-35V, output 1.5A max. TO-220 package.',
    category: 'voltage_regulator',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm7805.pdf',
  },
  {
    name: 'LM7812',
    modelType: 'VOLTAGE_REG',
    spiceDirective: [
      '.SUBCKT LM7812 IN GND OUT',
      'RI IN GND 25K',
      'XOP IN GND OUT VREGOP12',
      '.MODEL VREGOP12 NMOS(VTO=12.0 KP=0.5)',
      '.ENDS LM7812',
    ].join('\n'),
    parameters: { Vout: 12.0, Vin_min: 14.5, Vin_max: 35.0, Iout_max: 1.5, dropout: 2.0 },
    description: 'Positive 12V fixed linear voltage regulator. Input 14.5-35V, output 1.5A max. TO-220 package.',
    category: 'voltage_regulator',
    datasheet: null,
  },
  {
    name: 'LM317',
    modelType: 'VOLTAGE_REG',
    spiceDirective: [
      '.SUBCKT LM317 IN ADJ OUT',
      '* Simplified behavioral model',
      'V1 OUT ADJ 1.25',
      'RI IN OUT 1',
      '.ENDS LM317',
    ].join('\n'),
    parameters: { Vref: 1.25, Vin_max: 40, Iout_max: 1.5, dropout: 3.0 },
    description: 'Adjustable positive voltage regulator, 1.25V to 37V. Output set by two external resistors.',
    category: 'voltage_regulator',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm317.pdf',
  },

  // --- LEDs ---
  {
    name: 'LED_RED',
    modelType: 'LED',
    spiceDirective: '.MODEL LED_RED D(IS=9.35E-20 RS=2.0 N=1.8 BV=5 IBV=10E-6 CJO=2E-12 VJ=0.7 M=0.5)',
    parameters: { IS: 9.35e-20, RS: 2, N: 1.8, Vf_typ: 1.8 },
    description: 'Standard red LED. Typical forward voltage 1.8V at 20mA, wavelength ~625nm.',
    category: 'diode',
    datasheet: null,
  },
  {
    name: 'LED_GREEN',
    modelType: 'LED',
    spiceDirective: '.MODEL LED_GREEN D(IS=4.35E-20 RS=3.0 N=2.0 BV=5 IBV=10E-6 CJO=2E-12 VJ=0.7 M=0.5)',
    parameters: { IS: 4.35e-20, RS: 3, N: 2.0, Vf_typ: 2.2 },
    description: 'Standard green LED. Typical forward voltage 2.2V at 20mA, wavelength ~565nm.',
    category: 'diode',
    datasheet: null,
  },
];

async function seedStandardSpiceModels() {
  const created = [];
  for (const model of STANDARD_MODELS) {
    // Check if model already exists by name
    const existing = await storage.getSpiceModels({ search: model.name, limit: 1 });
    if (existing.models.some((m) => m.name === model.name)) {
      continue;
    }
    const result = await storage.createSpiceModel({
      name: model.name,
      modelType: model.modelType as InsertSpiceModel['modelType'],
      spiceDirective: model.spiceDirective,
      parameters: model.parameters,
      description: model.description,
      category: model.category as InsertSpiceModel['category'],
      datasheet: model.datasheet,
    });
    created.push(result);
  }
  return created;
}

// Re-export for use by other modules (e.g., the main seed route)
export { seedStandardSpiceModels, STANDARD_MODELS };
export type { SeedModel };
