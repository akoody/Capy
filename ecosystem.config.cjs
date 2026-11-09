/**
 * PM2: API (порт 3001) и фоновый воркер. Статику фронта раздаёт nginx из frontend/dist.
 * Имя capy-api — чтобы не пересекаться с другим приложением с name: server на том же хосте.
 *
 *   npm run build && pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'capy-api',
      cwd: __dirname,
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'capy-worker',
      cwd: __dirname,
      script: 'dist/worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
