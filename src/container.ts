import { PrismaClient } from "@prisma/client";
import { Role } from "./domain/enums.js";
import type { AppEnv } from "./config/env.js";
import { resolvePgPoolConfig, resolvePrismaDatabaseUrl } from "./config/database-connection.js";
import { AuthController } from "./controllers/auth.controller.js";
import { ArticleController } from "./controllers/article.controller.js";
import { AuthorDashboardController } from "./controllers/author-dashboard.controller.js";
import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  createRoleMiddleware,
} from "./middleware/auth.middleware.js";
import { PrismaArticleRepository } from "./repositories/prisma/article.repository.js";
import { PrismaDailyAnalyticsRepository } from "./repositories/prisma/daily-analytics.repository.js";
import { PrismaReadLogRepository } from "./repositories/prisma/read-log.repository.js";
import { PrismaUserRepository } from "./repositories/prisma/user.repository.js";
import { createApiRouter } from "./routes/index.js";
import { Argon2PasswordHasher } from "./security/argon2-password.hasher.js";
import { JwtTokenService } from "./security/jwt-token.service.js";
import { AnalyticsAggregationService } from "./services/analytics-aggregation.service.js";
import { ArticleService } from "./services/article.service.js";
import { AuthService } from "./services/auth.service.js";
import { AuthorDashboardService } from "./services/author-dashboard.service.js";
import { ReadTrackingService } from "./services/read-tracking.service.js";
import { AnalyticsJobScheduler, type IAnalyticsJobScheduler } from "./jobs/analytics-job.scheduler.js";

export type AppContainer = {
  env: AppEnv;
  prisma: PrismaClient;
  apiRouter: ReturnType<typeof createApiRouter>;
  analyticsScheduler: IAnalyticsJobScheduler;
  shutdown: () => Promise<void>;
};

export function buildContainer(env: AppEnv): AppContainer {
  const prisma = new PrismaClient({
    datasources: { db: { url: resolvePrismaDatabaseUrl(env) } },
  });

  const userRepo = new PrismaUserRepository(prisma);
  const articleRepo = new PrismaArticleRepository(prisma);
  const readLogRepo = new PrismaReadLogRepository(prisma);
  const dailyRepo = new PrismaDailyAnalyticsRepository(prisma);

  const passwordHasher = new Argon2PasswordHasher();
  const tokenService = new JwtTokenService(env);

  const authService = new AuthService(userRepo, passwordHasher, tokenService);
  const articleService = new ArticleService(articleRepo);
  const readTracking = new ReadTrackingService(readLogRepo, env);
  const aggregation = new AnalyticsAggregationService(readLogRepo, dailyRepo);
  const dashboardService = new AuthorDashboardService(articleRepo, dailyRepo);

  const authController = new AuthController(authService);
  const articleController = new ArticleController(articleService, readTracking, articleRepo);
  const dashboardController = new AuthorDashboardController(dashboardService);

  const requireAuth = createAuthMiddleware(tokenService);
  const optionalAuth = createOptionalAuthMiddleware(tokenService);
  const requireAuthor = createRoleMiddleware([Role.author]);

  const apiRouter = createApiRouter({
    auth: authController,
    articles: articleController,
    dashboard: dashboardController,
    guards: { requireAuth, optionalAuth, requireAuthor },
  });

  const analyticsScheduler = new AnalyticsJobScheduler(resolvePgPoolConfig(env), aggregation);

  return {
    env,
    prisma,
    apiRouter,
    analyticsScheduler,
    shutdown: async () => {
      await analyticsScheduler.stop();
      await prisma.$disconnect();
    },
  };
}
