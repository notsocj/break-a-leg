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
  addColumn: re('^alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?IDENT\\s+add\\s+(?:column\\s+)?(?:if\\s+not\\s+exists\\s+)?((?:"[^"]+"|[\\w$]+))'),
  dropTable: re('^drop\\s+table\\s+(?:if\\s+exists\\s+)?(.+?)(?:\\s+(?:cascade|restrict))?$'),
  policy: re('^create\\s+policy\\s+("[^"]+"|[\\w$]+)\\s+on\\s+IDENT'),
  alterPolicy: re('^alter\\s+policy\\s+("[^"]+"|[\\w$]+)\\s+on\\s+IDENT'),
  dropPolicy: re('^drop\\s+policy\\s+(?:if\\s+exists\\s+)?("[^"]+"|[\\w$]+)\\s+on\\s+IDENT'),
  columnPrivilege: re('^(?:grant\\s+(?:insert|update)\\s*\\(|revoke\\s+(?:all|insert|update)\\b).*?\\bon\\s+(?:table\\s+)?IDENT'),
  view: re('^create\\s+(?:or\\s+replace\\s+)?(materialized\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?IDENT'),
  func: re('^create\\s+(?:or\\s+replace\\s+)?function\\s+IDENT')
};

// Text inside the parentheses that open at `open`, honoring nesting.
function balanced(text: string, open: number): string | undefined {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return undefined;
}

// Column names from a CREATE TABLE column list, skipping table-level constraints.
function columnsOf(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) { parts.push(list.slice(start, i)); start = i + 1; }
  }
  parts.push(list.slice(start));
  return parts.map(p => p.trim().split(/\s+/)[0]?.replace(/"/g, '') ?? '')
    .filter(name => name && !/^(constraint|primary|foreign|unique|check|exclude|like)$/i.test(name));
}

// Column names that usually carry privileges or money: is_pro, coach_credits, role, plan, ...
const privilegedWords = new Set(['admin', 'pro', 'premium', 'paid', 'subscribed', 'vip', 'verified', 'role', 'roles', 'credit', 'credits', 'balance', 'plan', 'tier', 'subscription', 'entitlement', 'entitlements', 'quota', 'permission', 'permissions']);
const privileged = (column: string) => column.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split('_').some(word => privilegedWords.has(word));

// Row filters that every signed-in caller satisfies, after removing spaces, parentheses, and `select`.
// Anonymous sign-ins also get the authenticated role, so these are as open as the policy's roles.
const anySignedIn = new Set(['auth.uidisnotnull', "auth.role='authenticated'", "auth.jwt->>'role'='authenticated'"]);

// Leads from one policy's text. Called again when ALTER POLICY changes the expressions.
function policyLeads(flat: string, target: string, command: string, roles: string, where: { file: string; line: number }): RlsLead[] {
  const leads: RlsLead[] = [];
  const exprs = [/\busing\s*\(/i, /\bwith\s+check\s*\(/i]
    .map(keyword => { const m = keyword.exec(flat); return m ? balanced(flat, m.index + m[0].length - 1) : undefined; })
    .filter((e): e is string => e !== undefined)
    .map(e => e.toLowerCase().replace(/\bselect\b/g, '').replace(/[\s()]/g, ''));
  // `using (true)` / `with check (true)` means every row, for every role the policy names.
  if (exprs.includes('true')) {
    leads.push({ kind: 'policy-allows-all-rows', object: target, ...where, detail: `Policy for ${command} to ${roles} matches every row. Fine for truly public data; a leak if rows are private or per-user.` });
  } else if (exprs.some(e => anySignedIn.has(e))) {
    leads.push({ kind: 'policy-allows-any-signed-in-user', object: target, ...where, detail: `Policy for ${command} to ${roles} only checks that a user is signed in, so every user (including anonymous sign-ins) matches every row. A leak if rows are per-user or per-team.` });
  } else if (target === 'storage.objects' && !/\bauth\.(uid|jwt|role)\s*\(/i.test(flat)) {
    // Storage policies that only check bucket_id let any caller in `roles` reach every file.
    leads.push({ kind: 'storage-policy-without-identity', object: target, ...where, detail: `Storage policy for ${command} to ${roles} does not reference auth.uid()/auth.jwt(). Check whether files in that bucket are meant to be per-user.` });
  }
  if (/\b(?:raw_user_meta_data|user_metadata)\b/i.test(flat)) {
    leads.push({ kind: 'policy-uses-user-metadata', object: target, ...where, detail: 'Policy reads user_metadata, which signed-in users can change about themselves. Roles, tenants, or plans used for access must come from app_metadata or a table users cannot write.' });
  }
  return leads;
}

// Policy names are case-sensitive only when quoted, as in Postgres.
const policyName = (raw: string) => raw.startsWith('"') ? raw.slice(1, -1) : raw.toLowerCase();

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
  // Final state of each table: where it was created, its columns, and whether RLS is currently enabled.
  const tables = new Map<string, { file: string; line: number; rls: boolean; columns: string[] }>();
  // Policies by "table|name", so a later DROP or ALTER POLICY replaces what an earlier migration said.
  const policies = new Map<string, { table: string; command: string; roles: string; file: string; line: number; leads: RlsLead[] }>();
  // shortcut: any column-level grant or broad revoke marks the whole table restricted; per-column tracking would be exact.
  const columnRestricted = new Set<string>();
  const definerFunctions = new Map<string, { file: string; line: number; searchPath: boolean }>();
  const revoked = new Set<string>();
  for (const file of sqlFiles) {
    if ((await stat(file)).size > 4 * 1024 * 1024) continue;
    for (const { text, line } of splitSql(await readFile(file, 'utf8'))) {
      const flat = text.replace(/\s+/g, ' ');
      const where = { file: rel(file), line };
      let m: RegExpExecArray | null;
      if ((m = patterns.createTable.exec(flat))) {
        // Older Supabase projects grant new public tables to anon/authenticated automatically, so
        // a table is reachable through the REST API until RLS is enabled. Newer ones need explicit grants.
        const list = /^\s*\(/.test(flat.slice(m[0].length)) ? balanced(flat, flat.indexOf('(', m[0].length)) : undefined;
        if (!/^create\s+(?:(?:global|local)\s+)?(?:temp|temporary)/i.test(flat)) tables.set(qualify(m[1]), { ...where, rls: false, columns: list ? columnsOf(list) : [] });
      } else if ((m = patterns.rls.exec(flat))) {
        const table = tables.get(qualify(m[1]));
        if (table) table.rls = m[2].toLowerCase() === 'enable';
        else tables.set(qualify(m[1]), { ...where, rls: m[2].toLowerCase() === 'enable', columns: [] });
      } else if ((m = patterns.rename.exec(flat))) {
        const from = qualify(m[1]);
        const to = `${from.split('.')[0]}.${m[2].replace(/"/g, '').toLowerCase()}`;
        const table = tables.get(from);
        if (table) { tables.delete(from); tables.set(to, table); }
        for (const [key, policy] of policies) {
          if (policy.table === from) { policies.delete(key); policy.table = to; policies.set(`${to}|${key.split('|')[1]}`, policy); }
        }
      } else if ((m = patterns.addColumn.exec(flat))) {
        const name = m[2].replace(/"/g, '');
        if (!/^constraint$/i.test(name)) tables.get(qualify(m[1]))?.columns.push(name);
      } else if ((m = patterns.dropTable.exec(flat))) {
        for (const raw of m[1].split(',')) {
          const name = qualify(raw.trim());
          tables.delete(name);
          for (const [key, policy] of policies) if (policy.table === name) policies.delete(key);
        }
      } else if ((m = patterns.policy.exec(flat))) {
        const target = qualify(m[2]);
        const roles = /\bto\s+(.+?)(?:\s+using\b|\s+with\s+check\b|$)/i.exec(flat)?.[1]?.trim().toLowerCase() ?? 'public';
        const command = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(flat)?.[1]?.toLowerCase() ?? 'all';
        policies.set(`${target}|${policyName(m[1])}`, { table: target, command, roles, ...where, leads: policyLeads(flat, target, command, roles, where) });
      } else if ((m = patterns.alterPolicy.exec(flat))) {
        const target = qualify(m[2]);
        const policy = policies.get(`${target}|${policyName(m[1])}`);
        // ALTER POLICY ... RENAME is not followed; a renamed policy keeps its old key.
        if (policy && /\b(?:using|with\s+check)\s*\(/i.test(flat)) {
          policy.roles = /\bto\s+(.+?)(?:\s+using\b|\s+with\s+check\b|$)/i.exec(flat)?.[1]?.trim().toLowerCase() ?? policy.roles;
          Object.assign(policy, where, { leads: policyLeads(flat, target, policy.command, policy.roles, where) });
        }
      } else if ((m = patterns.dropPolicy.exec(flat))) {
        policies.delete(`${qualify(m[2])}|${policyName(m[1])}`);
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
      } else if ((m = patterns.columnPrivilege.exec(flat))) {
        columnRestricted.add(qualify(m[1]));
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
    if (!table.rls && exposedSchemas.includes(name.split('.')[0])) leads.push({ kind: 'table-without-rls', object: name, file: table.file, line: table.line, detail: 'No enable row level security found after replaying all migrations. Any role with a table grant can read or write every row through the Data API. Older projects grant anon and authenticated automatically; newer projects need explicit grants, so check both. A missing grant is not a substitute for RLS.' });
  }
  // Surviving policies keep their leads. A policy letting users write their own rows is also a lead
  // when the table holds privilege or money columns and no column grant limits what they can set.
  const flagged = new Set<string>();
  for (const policy of policies.values()) {
    leads.push(...policy.leads);
    const table = tables.get(policy.table);
    const risky = table?.columns.filter(privileged) ?? [];
    if (!table?.rls || !risky.length || flagged.has(policy.table) || columnRestricted.has(policy.table)) continue;
    if (!['all', 'insert', 'update'].includes(policy.command) || policy.roles === 'service_role' || !exposedSchemas.includes(policy.table.split('.')[0])) continue;
    flagged.add(policy.table);
    leads.push({ kind: 'user-writable-privileged-columns', object: policy.table, file: policy.file, line: policy.line, detail: `Policy for ${policy.command} to ${policy.roles} lets callers write rows, and no column grant limits what they set: ${risky.join(', ')}. RLS limits rows, not columns, so a user could grant themselves these values unless a trigger blocks it.` });
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
