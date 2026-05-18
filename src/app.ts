import express from "express";
import helmet from "helmet";
import type { AppContainer } from "./container.js";
import { createErrorMiddleware } from "./middleware/error.middleware.js";
import { okResponse } from "./http/responses.js";

export function createApp(container: AppContainer) {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json(okResponse("OK", { status: "healthy" }));
  });

  app.use(container.apiRouter);
  app.use(createErrorMiddleware(container.env.NODE_ENV));

  return app;
}
