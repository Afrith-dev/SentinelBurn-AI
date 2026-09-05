import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiLiveService } from './gemini-live.service';

test('GeminiLiveService exposes configuration status without crashing', () => {
  assert.equal(typeof GeminiLiveService.isConfigured, 'function');
  assert.equal(typeof GeminiLiveService.getModelName, 'function');
  assert.equal(typeof GeminiLiveService.getLiveModelName, 'function');
});

test('GeminiLiveService uses the current official Gemini Live model by default', () => {
  const previousLive = process.env.GEMINI_LIVE_MODEL;
  delete process.env.GEMINI_LIVE_MODEL;

  try {
    assert.equal(GeminiLiveService.getLiveModelName(), 'gemini-3.1-flash-live-preview');
  } finally {
    if (previousLive) process.env.GEMINI_LIVE_MODEL = previousLive;
  }
});

test('GeminiLiveService returns a clear fallback when the API key is missing', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const result = await GeminiLiveService.generateTextResponse('Why was DUT-104 flagged?');
    assert.equal(result.mode, 'fallback');
    assert.ok(result.text.toLowerCase().includes('not configured'));
  } finally {
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
  }
});
