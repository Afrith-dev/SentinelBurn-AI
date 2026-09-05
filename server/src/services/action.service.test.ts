import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionService } from './action.service';

const base = {
  userId: 'test-user',
  sessionId: 'test-session',
  runId: 'run-isro-live-001',
  deviceId: 'd-0017'
};

test('action registry creates a pending navigation action without executing it', () => {
  const pending = ActionService.createPending({ action: 'OPEN_DEVICE', args: base, userId: base.userId, sessionId: base.sessionId });
  assert.equal('error' in pending, false);
  if ('error' in pending) return;
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.category, 'UI_ACTION');
  assert.equal(ActionService.getPending(pending.actionId)?.status, 'PENDING');
});

test('confirmation executes exactly once and rejects a second confirmation', () => {
  const pending = ActionService.createPending({ action: 'OPEN_DEVICE', args: base, userId: base.userId, sessionId: base.sessionId });
  assert.equal('error' in pending, false);
  if ('error' in pending) return;

  const first = ActionService.confirm(pending.actionId, base.userId, base.sessionId);
  const second = ActionService.confirm(pending.actionId, base.userId, base.sessionId);

  assert.equal(first.status, 'EXECUTED');
  assert.equal(first.navigationUrl, '/runs/run-isro-live-001/devices/d-0017');
  assert.equal(second.status, 'FAILED');
});

test('confirmation cannot be used by another session', () => {
  const pending = ActionService.createPending({ action: 'OPEN_DEVICE', args: base, userId: base.userId, sessionId: base.sessionId });
  assert.equal('error' in pending, false);
  if ('error' in pending) return;

  const result = ActionService.confirm(pending.actionId, base.userId, 'other-session');
  assert.equal(result.status, 'FAILED');
});

test('natural confirmation and cancellation phrases are recognized', () => {
  assert.equal(ActionService.isAffirmative('go ahead'), true);
  assert.equal(ActionService.isAffirmative('open it'), true);
  assert.equal(ActionService.isNegative('never mind'), true);
  assert.equal(ActionService.isNegative('stop'), true);
});
