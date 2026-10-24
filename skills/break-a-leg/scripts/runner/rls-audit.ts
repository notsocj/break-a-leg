import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { ignoredDirectories } from './discover.ts';
import { VERSION } from './version.ts';

// Offline static audit of Supabase migrations and local config.
// It replays CREATE/ALTER/DROP statements in file order to learn the *final* state of each
// table, then reports "leads": patterns that commonly expose data in Supabase apps.
// A lead is a place to look, not a confirmed vulnerability; deployed state may differ.

export type RlsLead = {
  kind: string;
  object: string;
  file: string;
  line: number;
  detail: string;
};

type Statement = { text: string; line: number };

// Split SQL into statements on top-level semicolons. Comments are removed, and semicolons
// inside 'strings', "identifiers", and $tag$ dollar-quoted bodies (function code) are ignored.
// Each statement keeps the line number where it starts so leads can point at the source.
export function splitSql(sql: string): Statement[] {
  const statements: Statement[] = [];
  let current = '';
  let line = 1;
  let startLine = 1;
  let i = 0;
  const push = () => {
    const text = current.trim();
    if (text) statements.push({ text, line: startLine });
    current = '';
  };
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (!current.trim()) startLine = line; // first meaningful character sets the statement line
    if (ch === '-' && next === '-') { // line comment: skip to end of line
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') { // block comment: skip, but keep counting newlines
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) { if (sql[i] === '\n') line++; i++; }
      i += 2; current += ' ';
      continue;
    }
    if (ch === "'" || ch === '"') { // quoted string or identifier; '' and "" are escapes
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) { j += 2; continue; }
        if (sql[j] === ch) break;
        j++;
      }
      const chunk = sql.slice(i, j + 1);
      line += chunk.split('\n').length - 1; current += chunk; i = j + 1;
      continue;
    }
    if (ch === '$') { // dollar quote: $$ or $tag$ ... matching closing tag
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))?.[0];
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? sql.length : end + tag.length;
        const chunk = sql.slice(i, stop);
        line += chunk.split('\n').length - 1; current += chunk; i = stop;
        continue;
      }
    }
    if (ch === ';') { push(); i++; continue; }
    if (ch === '\n') line++;
    current += ch; i++;
  }
  push();
  return statements;
}

// Normalize an identifier like "Public"."Notes" or notes into schema.table form.
// Unqualified names default to the public schema, which is how Supabase migrations resolve them.
export function qualify(raw: string): string {
  const parts = raw.replace(/"/g, '').toLowerCase().split('.');
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : `public.${parts[0]}`;
}

const ident = '((?:"[^"]+"|[\\w$]+)(?:\\.(?:"[^"]+"|[\\w$]+))?)';
const re = (pattern: string) => new RegExp(pattern.replace(/IDENT/g, ident), 'is');
const patterns = {
  createTable: re('^create\\s+(?:(?:global|local)\\s+)?(?:(?:temp|temporary|unlogged)\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?IDENT'),
  rls: re('^alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?IDENT\\s+(enable|disable)\\s+row\\s+level\\s+security'),
  rename: re('^alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?IDENT\\s+rename\\s+to\\s+((?:"[^"]+"|[\\w$]+))'),
  dropTable: re('^drop\\s+table\\s+(?:if\\s+exists\\s+)?(.+?)(?:\\s+(?:cascade|restrict))?$'),
  policy: re('^create\\s+policy\\s+(?:"[^"]+"|[\\w$]+)\\s+on\\s+IDENT'),
  view: re('^create\\s+(?:or\\s+replace\\s+)?(materialized\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?IDENT'),
  func: re('^create\\s+(?:or\\s+replace\\s+)?function\\s+IDENT')
};

// Minimal TOML reader for supabase/config.toml: returns "section.key" → raw value.
// It only needs flat keys and simple arrays, which is all Supabase's config uses here.
export function readToml(text: string): Map<string, string> {
  const values = new Map<string, string>();
  let section = '';
  for (const rawLine of text.split('\n')) {
    const lineText = rawLine.replace(/\s+#.*$/, '').trim();
    if (!lineText || lineText.startsWith('#')) continue;
    const header = /^\[([^\]]+)\]$/.exec(lineText);
    if (header) { section = header[1].trim(); continue; }
    const pair = /^([\w.-]+)\s*=\s*(.+)$/.exec(lineText);
    if (pair) values.set(section ? `${section}.${pair[1]}` : pair[1], pair[2].trim());
  }
  return values;
}

// Audit one supabase/ directory: config.toml plus migrations and declarative schema files.
async function auditProject(dir: string, base: string) {
  const leads: RlsLead[] = [];
  const rel = (path: string) => relative(base, path).split('\\').join('/');
  let exposedSchemas = ['public', 'graphql_public'];

  // --- config.toml: API exposure, auth settings, and Edge Function JWT verification ---
  const configPath = join(dir, 'config.toml');
  try {
    const config = readToml(await readFile(configPath, 'utf8'));
    const schemas = config.get('api.schemas');
    if (schemas) exposedSchemas = [...schemas.matchAll(/"([^"]+)"/g)].map(m => m[1].toLowerCase());
    // Anonymous users receive the `authenticated` role, so `to authenticated` policies include them.
    if (config.get('auth.enable_anonymous_sign_ins') === 'true') leads.push({ kind: 'anonymous-sign-ins-enabled', object: 'auth', file: rel(configPath), line: 0, detail: 'Anonymous sign-ins create real sessions with the authenticated role. Check that policies granted to authenticated do not assume a verified or paying user.' });
    if (config.get('auth.email.enable_confirmations') === 'false') leads.push({ kind: 'email-confirmation-disabled', object: 'auth.email', file: rel(configPath), line: 0, detail: 'Local config allows sign-in without confirming the email address. Compare with the hosted project setting; unconfirmed emails must not grant access based on their domain or identity.' });
    for (const [key, value] of config) {
      const fn = /^functions\.([^.]+)\.verify_jwt$/.exec(key);
      if (fn && value === 'false') leads.push({ kind: 'function-jwt-verification-disabled', object: `functions.${fn[1]}`, file: rel(configPath), line: 0, detail: 'This Edge Function accepts calls without a valid Supabase JWT. That is correct for signed webhooks only if the handler verifies the provider signature; otherwise anyone can invoke it.' });
    }
  } catch { /* No local config: deployed settings are unknown and reported as a limitation. */ }

  // --- SQL: replay migrations (then declarative schemas) in name order ---
  const sqlFiles: string[] = [];
  for (const sub of ['migrations', 'schemas']) {
    try {
      const names = (await readdir(join(dir, sub))).filter(n => n.endsWith('.sql')).sort();
      for (const name of names) sqlFiles.push(join(dir, sub, name));
    } catch { /* folder absent */ }
  }
  // Final state of each table: where it was created and whether RLS is currently enabled.
  const tables = new Map<string, { file: string; line: number; rls: boolean }>();
  const definerFunctions = new Map<string, { file: string; line: number; searchPath: boolean }>();
  const revoked = new Set<string>();
  for (const file of sqlFiles) {
    if ((await stat(file)).size > 4 * 1024 * 1024) continue;
    for (const { text, line } of splitSql(await readFile(file, 'utf8'))) {
      const flat = text.replace(/\s+/g, ' ');
      const where = { file: rel(file), line };
      let m: RegExpExecArray | null;
      if ((m = patterns.createTable.exec(flat))) {
        // Supabase grants table access to anon/authenticated by default, so a new table is
        // reachable through the REST API until RLS is enabled.
        if (!/^create\s+(?:(?:global|local)\s+)?(?:temp|temporary)/i.test(flat)) tables.set(qualify(m[1]), { ...where, rls: false });
      } else if ((m = patterns.rls.exec(flat))) {
        const table = tables.get(qualify(m[1]));
        if (table) table.rls = m[2].toLowerCase() === 'enable';
        else tables.set(qualify(m[1]), { ...where, rls: m[2].toLowerCase() === 'enable' });
      } else if ((m = patterns.rename.exec(flat))) {
        const from = qualify(m[1]);
        const table = tables.get(from);
        if (table) { tables.delete(from); tables.set(`${from.split('.')[0]}.${m[2].replace(/"/g, '').toLowerCase()}`, table); }
      } else if ((m = patterns.dropTable.exec(flat))) {
        for (const name of m[1].split(',')) tables.delete(qualify(name.trim()));
      } else if ((m = patterns.policy.exec(flat))) {
        const target = qualify(m[1]);
        const roles = /\bto\s+(.+?)(?:\s+using\b|\s+with\s+check\b|$)/i.exec(flat)?.[1]?.trim().toLowerCase() ?? 'public';
        const command = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(flat)?.[1]?.toLowerCase() ?? 'all';
        // `using (true)` / `with check (true)` means every row, for every role the policy names.
        if (/\busing\s*\(\s*true\s*\)/i.test(flat) || /\bwith\s+check\s*\(\s*true\s*\)/i.test(flat)) {
          leads.push({ kind: 'policy-allows-all-rows', object: target, ...where, detail: `Policy for ${command} to ${roles} matches every row. Fine for truly public data; a leak if rows are private or per-user.` });
        } else if (target === 'storage.objects' && !/\bauth\.(uid|jwt|role)\s*\(/i.test(flat)) {
          // Storage policies that only check bucket_id let any caller in `roles` reach every file.
          leads.push({ kind: 'storage-policy-without-identity', object: target, ...where, detail: `Storage policy for ${command} to ${roles} does not reference auth.uid()/auth.jwt(). Check whether files in that bucket are meant to be per-user.` });
        }
      } else if ((m = patterns.view.exec(flat))) {
        const view = qualify(m[2]);
        // Views run with their owner's privileges unless security_invoker is set, so they can
        // bypass the RLS of the tables they read. Materialized views have no RLS at all.
        if (exposedSchemas.includes(view.split('.')[0]) && (m[1] || !/security_invoker\s*=\s*(true|on)/i.test(flat))) {
          leads.push({ kind: m[1] ? 'materialized-view-exposed' : 'view-bypasses-rls', object: view, ...where, detail: m[1] ? 'Materialized views are not protected by RLS; anyone with select access reads every row.' : 'View lacks security_invoker = true, so it reads underlying tables as its owner and can bypass their RLS.' });
        }
      } else if ((m = patterns.func.exec(flat))) {
        if (/\bsecurity\s+definer\b/i.test(flat)) definerFunctions.set(qualify(m[1]), { ...where, searchPath: /\bset\s+search_path\b/i.test(flat) });
      } else if (/^revoke\s+(?:all|execute)\b.*\bon\s+function\s+/i.test(flat)) {
        const fn = /\bon\s+function\s+((?:"[^"]+"|[\w$]+)(?:\.(?:"[^"]+"|[\w$]+))?)/i.exec(flat);
        if (fn) revoked.add(qualify(fn[1]));
      } else if (/^insert\s+into\s+storage\.buckets\b/i.test(flat)) {
        // Map the column list onto the first VALUES tuple to read the bucket's `public` flag.
        const cols = /storage\.buckets\s*\(([^)]*)\)/i.exec(flat)?.[1].split(',').map(c => c.trim().replace(/"/g, '').toLowerCase());
        const vals = /\bvalues\s*\(([^)]*)\)/i.exec(flat)?.[1].split(',').map(v => v.trim().toLowerCase());
        const at = cols?.indexOf('public') ?? -1;
        if (cols && vals && at >= 0 && vals[at] === 'true') leads.push({ kind: 'public-storage-bucket', object: `storage.buckets/${vals[cols.indexOf('id')]?.replace(/'/g, '') ?? '?'}`, ...where, detail: 'Public bucket: anyone with a file URL can download it without a policy check. Fine for avatars/marketing assets; a leak for private documents.' });
      } else if (/^update\s+storage\.buckets\s+set\b.*\bpublic\s*=\s*true/i.test(flat)) {
        leads.push({ kind: 'public-storage-bucket', object: 'storage.buckets', ...where, detail: 'A bucket is switched to public. Confirm its files are meant to be world-readable.' });
      }
    }
  }
  // After replaying everything, any exposed-schema table still without RLS is a lead.
  for (const [name, table] of tables) {
    if (!table.rls && exposedSchemas.includes(name.split('.')[0])) leads.push({ kind: 'table-without-rls', object: name, file: table.file, line: table.line, detail: 'No enable row level security found after replaying all migrations. Through the Data API, anon and authenticated callers may read or write every row unless grants were revoked.' });
  }
  for (const [name, fn] of definerFunctions) {
    if (!exposedSchemas.includes(name.split('.')[0])) continue;
    const notes = [];
    if (!fn.searchPath) notes.push('no fixed search_path');
    if (!revoked.has(name)) notes.push('callable through /rest/v1/rpc unless EXECUTE was revoked');
    if (notes.length) leads.push({ kind: 'security-definer-function', object: name, file: fn.file, line: fn.line, detail: `Runs with its owner's privileges and bypasses RLS (${notes.join('; ')}). Check that it verifies auth.uid() itself.` });
  }
  return { path: rel(dir) || '.', exposedSchemas, sqlFilesScanned: sqlFiles.length, tablesTracked: tables.size, leads };
}

// Find supabase/ directories (monorepos may have several) with a bounded breadth-first walk.
export async function rlsAudit(root: string, maxEntries = 20000) {
  const base = await realpath(root);
  if (!(await stat(base)).isDirectory()) throw new Error('Project root must be a directory');
  const projects = [];
  const queue = [base];
  let visited = 0;
  let truncated = false;
  while (queue.length && !truncated) {
    const directory = queue.shift()!;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (++visited > maxEntries) { truncated = true; break; }
      if (!entry.isDirectory() || entry.isSymbolicLink() || ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) continue;
      const absolute = join(directory, entry.name);
      if (entry.name === 'supabase') projects.push(await auditProject(absolute, base));
      else queue.push(absolute);
    }
  }
  return {
    schemaVersion: 1, toolVersion: VERSION, project: basename(base),
    projects, leadCount: projects.reduce((n, p) => n + p.leads.length, 0), truncated,
    limitations: [
      'Leads come from static text in local migrations and config.toml. Changes made in the Supabase dashboard, or migrations not committed, are invisible.',
      'A lead is a place to look, not a confirmed vulnerability: public data may intentionally allow every row. Confirm the intended access rule first.',
      'Policies that reference auth.uid() can still be wrong (for example, comparing the wrong column); review policy logic, grants, and RPCs by hand.',
      'The SQL parser understands common statement forms only; unusual syntax, dynamic SQL, and DO blocks are not interpreted.'
    ]
  };
}
