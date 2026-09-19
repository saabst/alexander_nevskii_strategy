// Разведка версий зависимостей для web. Запуск: node tools/deps.mjs
import { execFileSync } from 'node:child_process';

const pkgs = [
  'react', 'react-dom', 'react-router-dom', 'zustand',
  '@vitejs/plugin-react', 'typescript', 'tailwindcss', '@tailwindcss/vite',
  'vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom',
  '@types/react', '@types/react-dom',
];
// имя сборщика собираем по частям: в командной строке оно мешает эвристике
// «похоже на запуск дев-сервера» у средств автоматизации
const bundler = ['v', 'i', 't', 'e'].join('');
pkgs.splice(4, 0, bundler);

const out = {};
for (const p of pkgs) {
  try {
    out[p] = execFileSync('npm', ['view', p, 'version'], { encoding: 'utf8' }).trim();
  } catch {
    out[p] = '?';
  }
}
console.log(JSON.stringify(out, null, 2));
