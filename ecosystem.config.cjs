/**
 * PM2 ecosystem config for the CABQ Comprehensive Plan Action App.
 *
 * Usage (on the server):
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --update-env --env production
 *   pm2 save   (persist across reboots)
 *
 * The Fastify API runs on PORT 8787.
 * IIS (port 8080) reverse-proxies /api/* to this process.
 */

module.exports = {
  apps: [
    {
      name: "cabq-plan-api",
      script: "dist/index.js",
      cwd: "D:/cabq-plan",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env_production: {
        NODE_ENV: "production",
        PORT: "8787",
      },
    },
  ],
};
