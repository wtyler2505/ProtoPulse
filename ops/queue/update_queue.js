const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/home/wtyler/Projects/ProtoPulse/ops/queue/queue.json', 'utf8'));
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

data.tasks = data.tasks.map(task => {
  if (task.id === '2026-04-18-e2e-calculators-meticulous-baby-step') {
    return { ...task, status: 'done', completed: timestamp };
  }
  return task;
});

data.tasks.push({
  id: 'claim-063',
  type: 'claim',
  status: 'pending',
  target: 'LED resistor calculator correctly computes exact resistance alongside E24 and E96 standard values while providing accurate power calculations',
  classification: 'closed',
  batch: '2026-04-18-e2e-calculators-meticulous-baby-step',
  file: '2026-04-18-e2e-calculators-meticulous-baby-step-063.md',
  created: timestamp,
  current_phase: 'create',
  completed_phases: []
});
data.tasks.push({
  id: 'claim-064',
  type: 'claim',
  status: 'pending',
  target: 'Add to BOM and Apply to Component actions successfully integrate calculator outputs into procurement and architectural workflows',
  classification: 'closed',
  batch: '2026-04-18-e2e-calculators-meticulous-baby-step',
  file: '2026-04-18-e2e-calculators-meticulous-baby-step-064.md',
  created: timestamp,
  current_phase: 'create',
  completed_phases: []
});
data.tasks.push({
  id: 'claim-065',
  type: 'claim',
  status: 'pending',
  target: 'Spinbuttons across multiple calculator tabs incorrectly enforce valuemax=0 creating a recurring input restriction pattern',
  classification: 'closed',
  batch: '2026-04-18-e2e-calculators-meticulous-baby-step',
  file: '2026-04-18-e2e-calculators-meticulous-baby-step-065.md',
  created: timestamp,
  current_phase: 'create',
  completed_phases: []
});
data.tasks.push({
  id: 'claim-066',
  type: 'claim',
  status: 'pending',
  target: 'Presets dropdowns for standard component types like LEDs should auto-fill default values in calculators to speed up entry',
  classification: 'closed',
  batch: '2026-04-18-e2e-calculators-meticulous-baby-step',
  file: '2026-04-18-e2e-calculators-meticulous-baby-step-066.md',
  created: timestamp,
  current_phase: 'create',
  completed_phases: []
});

fs.writeFileSync('/home/wtyler/Projects/ProtoPulse/ops/queue/queue.json', JSON.stringify(data, null, 2));
