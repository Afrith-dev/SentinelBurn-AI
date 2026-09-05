import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisService } from './analysis.service';

test('run analysis uses the seeded SentinelBurn run and reports real coverage', async () => {
  const analysis = await AnalysisService.analyzeRun('run-isro-live-001');
  assert.equal(analysis.run.runId, 'run-isro-live-001');
  assert.equal(analysis.run.totalDevices, 200);
  assert.equal(typeof analysis.run.reportingDevices, 'number');
  assert.equal(Array.isArray(analysis.anomalies), true);
  assert.equal(typeof analysis.recommendation, 'string');
});

test('missing device analysis is explicit instead of fabricated', async () => {
  const result = await AnalysisService.getDeviceAnalysis('run-isro-live-001', 'd-9999');
  assert.equal(result.available, false);
  assert.match(result.message || '', /not found/i);
});
