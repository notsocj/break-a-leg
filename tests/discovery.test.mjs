import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover } from '../runner/discover.ts';

test('discovers four mobile stacks and shared backend signals without treating them as findings', async () => {
  const r = await discover('tests/fixtures');
  assert.deepEqual(r.stacks, ['android', 'expo', 'firebase', 'flutter', 'ios', 'react-native', 'supabase']);
  assert.equal(r.truncated, false); assert.equal(r.findings, undefined);
});
test('skips dependency folders, secrets, symlinks and oversized manifests', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-discover-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'node_modules')); await writeFile(join(dir, 'node_modules', 'pubspec.yaml'), 'flutter: yes');
  await writeFile(join(dir, '.env'), 'DO_NOT_EMIT_SECRET=fixture-secret-value');
  await writeFile(join(dir, 'package.json'), ' '.repeat(262145));
  await symlink(join(dir, 'node_modules'), join(dir, 'linked'));
  const r = await discover(dir);
  assert.deepEqual(r.stacks, []); assert.equal(r.unreadableEntries, 1);
  assert.ok(!JSON.stringify(r).includes('fixture-secret-value'));
});
test('bounded discovery explicitly reports truncation', async () => {
  assert.equal((await discover('tests/fixtures', 1)).truncated, true);
});
