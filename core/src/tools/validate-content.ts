/**
 * Проверка контента из командной строки: npx tsx src/tools/validate-content.ts
 * Годится для CI: ненулевой код возврата, если контент сломан.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateScenario } from '../validation/schema';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'content', 'scenarios');

let bad = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const { ok, issues } = validateScenario(raw);
  if (ok) {
    console.log(`OK   ${file}: событий ${raw.events.length}`);
  } else {
    bad++;
    console.log(`БЕДА ${file}: проблем ${issues.length}`);
    for (const i of issues) console.log(`     [${i.kind}] ${i.path}: ${i.message}`);
  }
}
process.exit(bad ? 1 : 0);
