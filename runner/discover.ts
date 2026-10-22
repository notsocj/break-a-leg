import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { VERSION } from './version.ts';

const ignored = new Set(['.git', '.svn', '.hg', 'node_modules', '.dart_tool', '.gradle', '.idea', '.next', '.expo', '.venv', 'venv', 'Pods', 'Carthage', 'DerivedData', 'build', 'dist', 'coverage', '.break-a-leg']);
export async function discover(root: string, maxEntries = 20000) {
  const base = await realpath(root);
  if (!(await stat(base)).isDirectory()) throw new Error('Project root must be a directory');
  const signals: Array<{ stack: string; path: string }> = [];
  const add = (stack: string, path: string) => { if (signals.length < 500 && !signals.some(s => s.stack === stack && s.path === path)) signals.push({ stack, path }); };
  let visited = 0;
  let truncated = false;
  let unreadable = 0;
  const queue = [base];
  while (queue.length && !truncated) {
    const directory = queue.shift()!;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { unreadable++; continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++visited > maxEntries) { truncated = true; break; }
      if (entry.isSymbolicLink() || ignored.has(entry.name) || entry.name.startsWith('.')) continue;
      const absolute = join(directory, entry.name);
      const path = relative(base, absolute).split('\\').join('/');
      if (entry.isDirectory()) {
        if (entry.name.endsWith('.xcodeproj')) add('ios', path);
        queue.push(absolute); continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === 'AndroidManifest.xml') add('android', path);
      if (entry.name === 'firebase.json' || entry.name === 'firestore.rules' || entry.name === 'storage.rules') add('firebase', path);
      if (entry.name === 'config.toml' && basename(directory) === 'supabase') add('supabase', path);
      if (/^openapi\.(json|ya?ml)$/.test(entry.name)) add('custom-api', path);
      if (!['pubspec.yaml', 'package.json'].includes(entry.name)) continue;
      try {
        if ((await stat(absolute)).size > 262144) { unreadable++; continue; }
        const content = await readFile(absolute, 'utf8');
        if (entry.name === 'pubspec.yaml') {
          if (/\bflutter\s*:/.test(content)) add('flutter', path);
          if (/\bsupabase_flutter\s*:/.test(content)) add('supabase', path);
          if (/\bfirebase_core\s*:/.test(content)) add('firebase', path);
        } else {
          const parsed = JSON.parse(content);
          const deps = { ...parsed.dependencies, ...parsed.devDependencies };
          if (deps['react-native']) add('react-native', path);
          if (deps.expo) add('expo', path);
          if (deps['@supabase/supabase-js']) add('supabase', path);
          if (deps.firebase || deps['@react-native-firebase/app']) add('firebase', path);
        }
      } catch { unreadable++; }
    }
  }
  return {
    schemaVersion: 1, toolVersion: VERSION, project: basename(base),
    stacks: [...new Set(signals.map(s => s.stack))].sort(), signals,
    entriesVisited: visited, truncated, unreadableEntries: unreadable,
    limitations: [
      'Discovery identifies candidate stacks; it does not scan for vulnerabilities or verify a runnable app.',
      'Hidden entries, symbolic links, common build/dependency directories, and source contents other than small manifests are skipped.',
      'Custom ignore files are not interpreted. Signals are capped at 500 and directory entries at the configured limit.',
      'Swift/Kotlin backends, unusual layouts, generated native shells, and dependencies can produce missing or overlapping signals; inspect the selected app root.'
    ]
  };
}
