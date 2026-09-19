#!/usr/bin/env node
/**
 * Кладёт собранную игру в папку release/ под понятным именем.
 *
 * Играть — двойным кликом по release/nevsky.html: файл самодостаточен,
 * картинки лежат внутри него, сеть ему не нужна.
 *
 * Запуск из корня репозитория:  npm run release
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'web', 'dist-offline', 'index.html');
const DST = join(ROOT, 'release', 'nevsky.html');
const SCENARIOS = join(ROOT, 'core', 'src', 'content', 'scenarios');

if (!existsSync(SRC)) {
  console.error('Сборки нет: web/dist-offline/index.html');
  console.error('Сперва соберите: npm run build:offline');
  process.exit(1);
}

/** Сколько подлинников обещает контент: столько и должно лежать в файле. */
function expectedWitnesses() {
  const files = new Set();
  for (const name of readdirSync(SCENARIOS)) {
    if (!name.endsWith('.json')) continue;
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, name), 'utf8'));
    for (const event of scenario.events ?? []) {
      const file = event.illustration?.file;
      if (file) files.add(file);
    }
  }
  return files.size;
}

const html = readFileSync(SRC, 'utf8');
// Считаем именно подлинники. В документе есть ещё служебный SVG из стилей —
// он к свидетелям отношения не имеет и путал бы счёт.
const witnesses = (html.match(/data:image\/webp;base64/g) ?? []).length;
const external = (html.match(/src="https?:\/\//g) ?? []).length;
const expected = expectedWitnesses();

if (external > 0) {
  console.error(`В сборке ${external} внешних ссылок на картинки — это не офлайн.`);
  process.exit(1);
}
if (witnesses < expected) {
  console.error(`Контент обещает ${expected} подлинников, а в сборке их ${witnesses}.`);
  console.error('Картинка потерялась — такую сборку класть в release нельзя.');
  process.exit(1);
}

mkdirSync(dirname(DST), { recursive: true });
copyFileSync(SRC, DST);

const kb = (statSync(DST).size / 1024).toFixed(0);
console.log(`release/nevsky.html — ${kb} КБ, подлинников внутри: ${witnesses} из ${expected}, внешних ссылок: ${external}`);
if (witnesses > expected) {
  console.log(`  (лишних файлов в web/src/assets/images: ${witnesses - expected} — они не привязаны ни к одному событию)`);
}
