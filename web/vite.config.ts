import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Офлайн-сборка — один файл.
 *
 * Зачем: обычная сборка Vite отдаёт <script type="module" crossorigin> и
 * <link crossorigin>. При открытии двойным кликом с флешки origin равен null,
 * и браузер режет эти подресурсы по CORS — страница остаётся пустой.
 * Проверено 19.09.2026: без флага --allow-file-access-from-files #root пуст,
 * в консоли «blocked by CORS policy» и на скрипт, и на стили.
 *
 * Сборка одним файлом (скрипт и стили внутрь документа, шрифт как data:)
 * снимает вопрос совсем: скачивать нечего, значит и блокировать нечего.
 * Артефакт для флешки — dist-offline/index.html.
 */
const offline = process.env.NEVSKY_OFFLINE === '1';

export default defineConfig({
  // статика без сервера: база «./» чтобы сборка открывалась и с диска, и с флешки
  base: './',
  plugins: [react(), tailwindcss(), ...(offline ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  // @nevsky/core — это исходники на TypeScript, Vite обязан их не пре-бандлить,
  // иначе правка движка не подхватится на горячей перезагрузке
  optimizeDeps: { exclude: ['@nevsky/core'] },
  server: { host: true, port: 5173 },
  build: {
    outDir: offline ? 'dist-offline' : 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    // в офлайн-сборке всё уходит внутрь документа, включая шрифт
    assetsInlineLimit: offline ? 100 * 1024 * 1024 : 4096,
  },
  test: {
    // happy-dom, а не jsdom: jsdom 28+ тянет undici, которому нужен Node 22+
    // (webidl.util.markAsUncloneable). На Node 20 воркеры падают до старта тестов.
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
