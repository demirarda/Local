#!/usr/bin/env node
import { runAllSanitySimulations } from '../services/rsSanitySimulation.js';

const report = runAllSanitySimulations();
console.log('\n=== RS Sanity Simulation (LOCAL_RS §16) ===\n');
for (const r of report.results) {
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(
    `[${mark}] ${r.label}\n       expected ${r.expected_rs} ± ${r.tolerance} → actual ${r.actual_rs} (Δ ${r.delta})\n`
  );
}
console.log(`Summary: ${report.passed}/${report.total} passed\n`);
process.exit(report.all_pass ? 0 : 1);
