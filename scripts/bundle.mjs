import { readdir, readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
for (const [source, destination, suffix] of [
  ['runner', 'skills/break-a-leg/scripts/runner', '.ts'],
  ['schemas', 'skills/break-a-leg/references/schemas', '.json']
]) {
  if (!check) await mkdir(join(root, destination), { recursive: true });
  const names = (await readdir(join(root, source))).filter(n => n.endsWith(suffix));
  const existing = await readdir(join(root, destination), { withFileTypes: true });
  for (const entry of existing) {
    if (!entry.isFile() || !entry.name.endsWith(suffix)) throw new Error(`Unexpected entry in generated directory: ${entry.name}`);
    if (!names.includes(entry.name)) {
      if (check) throw new Error(`Obsolete generated file: ${entry.name}`);
      await unlink(join(root, destination, entry.name));
    }
  }
  for (const name of names) {
    const content = await readFile(join(root, source, name));
    const target = join(root, destination, name);
    if (check) {
      if (!(await readFile(target)).equals(content)) throw new Error(`Stale skill bundle: ${name}`);
    } else await writeFile(target, content);
  }
}
const license = await readFile(join(root, 'LICENSE'));
const licenseTarget = join(root, 'skills/break-a-leg/LICENSE.txt');
if (check) {
  if (!(await readFile(licenseTarget)).equals(license)) throw new Error('Stale bundled license');
} else await writeFile(licenseTarget, license);
console.log(check ? 'Skill runtime and schemas match their source files.' : 'Self-contained skill runtime and schemas bundled.');
