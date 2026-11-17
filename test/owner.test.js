// Runs against the compiled package (npm test builds it first).
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { state } = require('../lib/state');
const { ownerKey, sha256, tokenKey, draftKey, ANON } = require('../lib/owner');

test('sha256 matches the standard one', () => {
  for (const t of ['', 'abc', 'id:user-1', 'email:maría@example.com', '😀', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)]) {
    assert.strictEqual(sha256(t), crypto.createHash('sha256').update(t, 'utf8').digest('hex'));
  }
});

test('people who collided under the old short hash get different keys', () => {
  assert.notStrictEqual(ownerKey({ id: 'user-651248' }), ownerKey({ id: 'user-1684092' }));
  assert.notStrictEqual(ownerKey({ id: 'review-f0b92b6934bb9f5abeaf' }), ownerKey({ id: 'review-5fa88252751961e2d50b' }));
});

test('keys are stable, hide emails and fall back to anonymous', () => {
  assert.strictEqual(ownerKey({ id: 'a' }), ownerKey({ id: 'a', email: 'x@y.z' }));
  assert.strictEqual(ownerKey({ email: 'Sam@Example.com ' }), ownerKey({ email: 'sam@example.com' }));
  assert.ok(!ownerKey({ email: 'sam@example.com' }).includes('sam'));
  assert.strictEqual(ownerKey({}), ANON);
  assert.strictEqual(ownerKey({ id: 'a' }).length, 32);
});

test('saved sessions and drafts are kept apart per app and per person', () => {
  state.appId = 'app-1';
  const a = ownerKey({ id: 'a' }), b = ownerKey({ id: 'b' });
  assert.notStrictEqual(tokenKey(a), tokenKey(b));
  assert.notStrictEqual(draftKey(a), draftKey(b));
  const first = draftKey(a);
  state.appId = 'app-2';
  assert.notStrictEqual(draftKey(a), first);
});
