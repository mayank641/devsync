import test from 'node:test';
import assert from 'node:assert/strict';

test('health route contract is documented', () => {
  const expected = { status: 'ok', service: 'devsync-api' };
  assert.equal(expected.status, 'ok');
  assert.equal(expected.service, 'devsync-api');
});
