import { loadEnvConfig } from "./config/env.js";
import { buildContainer } from "./container.js";
import { createApp } from "./app.js";

async function bootstrap() {
  const env = loadEnvConfig();
  const container = buildContainer(env);
  const app = createApp(container);

  await container.analyticsScheduler.start();

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`News API listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down...`);
    server.close();
    await container.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", err);
  process.exit(1);
});
