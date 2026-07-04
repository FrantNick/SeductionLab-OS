/**
 * PM2 process file for self-hosting (see README → "Self-hosting on your
 * PC via ngrok"). Two processes, both kept alive by PM2:
 *
 *   pm2 start ecosystem.config.js
 *   pm2 save            # then set up PM2 to start at boot (README)
 *
 * The ngrok tunnel deliberately runs as its own Windows service, NOT
 * under PM2 — see ngrok.example.yml.
 */
module.exports = {
  apps: [
    {
      name: "seductionlab-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 50,
      restart_delay: 2000,
    },
    {
      name: "seductionlab-jobs",
      script: "scripts/jobs-cron.mjs",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
    },
  ],
};
