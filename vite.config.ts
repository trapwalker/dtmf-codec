import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    // Разрешаем все хосты для работы с туннелями и проброшенными портами
    // ВАЖНО: Для разработки отключаем проверку хоста (небезопасно для продакшена!)
    // Альтернатива: используйте переменную окружения __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
    allowedHosts: true,
    // Отключаем строгую проверку для разработки
    strictPort: false,
  },
});

