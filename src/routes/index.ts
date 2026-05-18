import { Router } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import type { ArticleController } from "../controllers/article.controller.js";
import type { AuthorDashboardController } from "../controllers/author-dashboard.controller.js";
import type { RequestHandler } from "express";

export type RouteGuards = {
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
  requireAuthor: RequestHandler;
};

export function createApiRouter(deps: {
  auth: AuthController;
  articles: ArticleController;
  dashboard: AuthorDashboardController;
  guards: RouteGuards;
}): Router {
  const router = Router();
  const { guards } = deps;

  router.post("/auth/signup", deps.auth.signup);
  router.post("/auth/login", deps.auth.login);
  router.get("/auth/me", guards.requireAuth, deps.auth.me);

  // Static paths before :id
  router.get("/articles/me", guards.requireAuth, guards.requireAuthor, deps.articles.listMine);
  router.get("/articles", deps.articles.listPublic);
  router.get("/articles/:id", guards.optionalAuth, deps.articles.getById);

  router.post("/articles", guards.requireAuth, guards.requireAuthor, deps.articles.create);
  router.put("/articles/:id", guards.requireAuth, guards.requireAuthor, deps.articles.update);
  router.delete("/articles/:id", guards.requireAuth, guards.requireAuthor, deps.articles.remove);

  router.get("/author/dashboard", guards.requireAuth, guards.requireAuthor, deps.dashboard.getDashboard);

  return router;
}
