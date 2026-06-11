#!/usr/bin/env node
import process from 'node:process';
import {
  formatBreadboardInspectionReport,
  inspectBreadboardView,
} from './inspect-breadboard-view.mjs';

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectBreadboardView();
  console.log(formatBreadboardInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

export { formatBreadboardInspectionReport, inspectBreadboardView };
