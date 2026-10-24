import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { VERSION } from './version.ts';

// Directories that hold dependencies, build output, or tool state rather than project source.
export const ignoredDirectories = new Set(['.git', '.svn', '.hg', 'node_modules', '.dart_tool', '.gradle', '.idea', '.next', '.expo', '.venv', 'venv', 'Pods', 'Carthage', 'DerivedData', 'build', 'dist', 'coverage', '.break-a-leg', '.turbo', '.vercel', '.output', '__pycache__']);

// JavaScript/TypeScript dependency name → candidate stack. A lookup table keeps detection
// easy to extend: add a row instead of another `if` branch.
const npmStacks: Record<string, string> = {
  'react-native': 'react-native', 'expo': 'expo',
  '@capacitor/core': 'capacitor', '@ionic/core': 'capacitor',
  '@supabase/supabase-js': 'supabase', '@supabase/ssr': 'supabase', '@supabase/auth-helpers-nextjs': 'supabase',
  'firebase': 'firebase', '@react-native-firebase/app': 'firebase', 'firebase-admin': 'firebase', 'firebase-functions': 'firebase',
  // Server frameworks: the app's own backend, reviewed with the custom API guide.
  'next': 'custom-api', 'express': 'custom-api', 'fastify': 'custom-api', 'hono': 'custom-api',
  '@nestjs/core': 'custom-api', 'koa': 'custom-api', '@trpc/server': 'custom-api', 'convex': 'custom-api'
};

// Dependency name → check guide worth reading. These are hints about where risk usually is,
// not findings: a payment SDK means "trace who grants the entitlement", not "this is broken".
const npmChecks: Record<string, string> = {
  'stripe': 'paid-features', 'react-native-purchases': 'paid-features', 'react-native-iap': 'paid-features',
  'expo-in-app-purchases': 'paid-features', '@revenuecat/purchases-js': 'paid-features', '@lemonsqueezy/lemonsqueezy.js': 'paid-features', '@polar-sh/sdk': 'paid-features',
  'openai': 'ai-features', '@anthropic-ai/sdk': 'ai-features', '@google/generative-ai': 'ai-features', '@google/genai': 'ai-features', 'ai': 'ai-features', 'langchain': 'ai-features', '@langchain/core': 'ai-features',
  'expo-local-authentication': 'local-data', 'react-native-biometrics': 'local-data', 'expo-secure-store': 'local-data', 'expo-sqlite': 'local-data', 'react-native-mmkv': 'local-data', 'react-native-keychain': 'local-data',
  'expo-auth-session': 'auth-flows', 'react-native-app-auth': 'auth-flows', '@react-native-google-signin/google-signin': 'auth-flows', 'expo-apple-authentication': 'auth-flows', 'expo-linking': 'auth-flows', 'next-auth': 'auth-flows', '@auth/core': 'auth-flows', '@clerk/clerk-expo': 'auth-flows',
  'expo-notifications': 'auth-flows'
};

// Flutter pubspec dependency names → stack or check (same idea as the npm tables).
const dartStacks: Record<string, string> = { 'supabase_flutter': 'supabase', 'supabase': 'supabase', 'firebase_core': 'firebase', 'cloud_firestore': 'firebase', 'firebase_auth': 'firebase' };
const dartChecks: Record<string, string> = {
  'purchases_flutter': 'paid-features', 'in_app_purchase': 'paid-features',
  'google_generative_ai': 'ai-features', 'dart_openai': 'ai-features', 'firebase_vertexai': 'ai-features', 'firebase_ai': 'ai-features',
  'local_auth': 'local-data', 'flutter_secure_storage': 'local-data', 'sqflite': 'local-data', 'drift': 'local-data', 'hive': 'local-data', 'isar': 'local-data',
  'google_sign_in': 'auth-flows', 'sign_in_with_apple': 'auth-flows', 'flutter_appauth': 'auth-flows', 'app_links': 'auth-flows', 'uni_links': 'auth-flows'
};

// Python and Go backends are matched by framework names appearing in their manifests.
const pythonApi = /^\s*(fastapi|django|flask|starlette|litestar)\b/im;
const goApi = /github\.com\/(gin-gonic\/gin|labstack\/echo|gofiber\/fiber|go-chi\/chi)/;

export async function discover(root: string, maxEntries = 20000) {
  const base = await realpath(root);
  if (!(await stat(base)).isDirectory()) throw new Error('Project root must be a directory');
  const signals: Array<{ stack: string; path: string }> = [];
  const checkSignals: Array<{ check: string; path: string; source: string }> = [];
  const add = (stack: string, path: string) => { if (signals.length < 500 && !signals.some(s => s.stack === stack && s.path === path)) signals.push({ stack, path }); };
  const suggest = (check: string, path: string, source: string) => {
    if (checkSignals.length < 500 && !checkSignals.some(s => s.check === check && s.path === path && s.source === source)) checkSignals.push({ check, path, source });
  };
  let visited = 0;
  let truncated = false;
  let unreadable = 0;
  const queue = [base];
  // Read a small manifest; oversized or unreadable files are counted, never parsed.
  const small = async (absolute: string) => {
    if ((await stat(absolute)).size > 262144) { unreadable++; return undefined; }
    return readFile(absolute, 'utf8');
  };
  while (queue.length && !truncated) {
    const directory = queue.shift()!;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { unreadable++; continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++visited > maxEntries) { truncated = true; break; }
      if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) continue;
      const absolute = join(directory, entry.name);
      const path = relative(base, absolute).split('\\').join('/');
      const parent = basename(directory);
      if (entry.isDirectory()) {
        if (entry.name.endsWith('.xcodeproj') || entry.name.endsWith('.xcworkspace')) add('ios', path);
        // Supabase projects often keep migrations/functions without a committed config.toml.
        if (parent === 'supabase' && ['migrations', 'functions', 'schemas'].includes(entry.name)) add('supabase', path);
        queue.push(absolute); continue;
      }
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (name === 'AndroidManifest.xml') add('android', path);
      if (['firebase.json', 'firestore.rules', 'storage.rules', 'database.rules.json', 'google-services.json', 'GoogleService-Info.plist'].includes(name)) add('firebase', path);
      if (name === 'config.toml' && parent === 'supabase') add('supabase', path);
      if (/^openapi\.(json|ya?ml)$/.test(name)) add('custom-api', path);
      if (name === 'Podfile') add('ios', path);
      if (!['pubspec.yaml', 'package.json', 'Package.swift', 'requirements.txt', 'pyproject.toml', 'go.mod'].includes(name)) continue;
      try {
        const content = await small(absolute);
        if (content === undefined) continue;
        if (name === 'pubspec.yaml') {
          if (/\bflutter\s*:/.test(content)) add('flutter', path);
          // Dependency keys are indented `name:` lines; match each table entry exactly.
          for (const [dep, stack] of Object.entries(dartStacks)) if (new RegExp(`^\\s+${dep}\\s*:`, 'm').test(content)) add(stack, path);
          for (const [dep, check] of Object.entries(dartChecks)) if (new RegExp(`^\\s+${dep}\\s*:`, 'm').test(content)) suggest(check, path, dep);
        } else if (name === 'package.json') {
          const parsed = JSON.parse(content);
          const deps = { ...parsed.dependencies, ...parsed.devDependencies };
          for (const dep of Object.keys(deps)) {
            if (npmStacks[dep]) add(npmStacks[dep], path);
            if (npmChecks[dep]) suggest(npmChecks[dep], path, dep);
          }
        } else if (name === 'Package.swift') {
          // A Swift package is either an iOS app/library or a server (Vapor/Hummingbird).
          add(/vapor|hummingbird/i.test(content) ? 'custom-api' : 'ios', path);
        } else if (name === 'go.mod') {
          if (goApi.test(content)) add('custom-api', path);
        } else {
          if (pythonApi.test(content) || /["'](fastapi|django|flask)[\s"'<>=~]/i.test(content)) add('custom-api', path);
          if (/\bsupabase\b/i.test(content)) add('supabase', path);
          if (/\bfirebase[-_]admin\b/i.test(content)) add('firebase', path);
          if (/\b(stripe)\b/i.test(content)) suggest('paid-features', path, 'stripe');
          if (/\b(openai|anthropic)\b/i.test(content)) suggest('ai-features', path, 'llm sdk');
        }
      } catch { unreadable++; }
    }
  }
  return {
    schemaVersion: 1, toolVersion: VERSION, project: basename(base),
    stacks: [...new Set(signals.map(s => s.stack))].sort(), signals,
    // Check guides worth reading because of what the project depends on. Hints only.
    suggestedChecks: [...new Set(checkSignals.map(s => s.check))].sort(), checkSignals,
    entriesVisited: visited, truncated, unreadableEntries: unreadable,
    limitations: [
      'Discovery identifies candidate stacks and suggested check guides; it does not scan for vulnerabilities or verify a runnable app.',
      'Hidden entries, symbolic links, common build/dependency directories, and source contents other than small manifests are skipped.',
      'Custom ignore files are not interpreted. Signals are capped at 500 and directory entries at the configured limit.',
      'A server framework (for example Next.js) may serve only a marketing site; confirm that API routes or server actions exist before reviewing it as a backend.',
      'Unusual layouts, generated native shells, and dependencies can produce missing or overlapping signals; inspect the selected app root.'
    ]
  };
}
