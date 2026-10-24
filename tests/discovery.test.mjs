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
test('detects common indie stacks: Next.js API, Supabase migrations, Firebase config files, Swift packages, Python APIs', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-discover-indie-')); t.after(() => rm(dir, { recursive: true, force: true }));
  // Expo app with paid, AI, local-data and sign-in dependencies.
  await mkdir(join(dir, 'app'));
  await writeFile(join(dir, 'app', 'package.json'), JSON.stringify({ dependencies: { expo: '1', 'react-native': '1', 'react-native-purchases': '1', 'expo-secure-store': '1', 'expo-auth-session': '1' } }));
  // Next.js backend using the SSR Supabase client, Stripe and OpenAI.
  await mkdir(join(dir, 'web'));
  await writeFile(join(dir, 'web', 'package.json'), JSON.stringify({ dependencies: { next: '1', '@supabase/ssr': '1', stripe: '1', openai: '1' } }));
  // Supabase migrations and functions without a committed config.toml.
  await mkdir(join(dir, 'supabase', 'migrations'), { recursive: true });
  await mkdir(join(dir, 'supabase', 'functions', 'ai'), { recursive: true });
  // Firebase client config, an Xcode workspace, a native Swift package, and a Python API.
  await mkdir(join(dir, 'android', 'app'), { recursive: true });
  await writeFile(join(dir, 'android', 'app', 'google-services.json'), '{}');
  await mkdir(join(dir, 'ios', 'Runner.xcworkspace'), { recursive: true });
  await mkdir(join(dir, 'server'));
  await writeFile(join(dir, 'server', 'requirements.txt'), 'fastapi==0.110\nuvicorn\n');
  await mkdir(join(dir, 'vapor'));
  await writeFile(join(dir, 'vapor', 'Package.swift'), '.package(url: "https://github.com/vapor/vapor.git", from: "4.0.0")');
  const r = await discover(dir);
  assert.deepEqual(r.stacks, ['custom-api', 'expo', 'firebase', 'ios', 'react-native', 'supabase']);
  assert.deepEqual(r.suggestedChecks, ['ai-features', 'auth-flows', 'local-data', 'paid-features']);
  assert.ok(r.signals.some(s => s.stack === 'supabase' && s.path === 'supabase/migrations'));
  assert.ok(r.signals.some(s => s.stack === 'custom-api' && s.path === 'vapor/Package.swift'));
  assert.ok(r.checkSignals.some(s => s.check === 'paid-features' && s.source === 'react-native-purchases'));
});
test('Flutter dependency entries map to backend stacks and check guides', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-discover-flutter-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'pubspec.yaml'), 'dependencies:\n  flutter:\n    sdk: flutter\n  cloud_firestore: any\n  purchases_flutter: any\n  local_auth: any\n');
  const r = await discover(dir);
  assert.deepEqual(r.stacks, ['firebase', 'flutter']);
  assert.deepEqual(r.suggestedChecks, ['local-data', 'paid-features']);
});
