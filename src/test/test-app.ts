import express from "express";
import type { ArticleRecord, UserRecord } from "../domain/entities.js";
import { ArticleStatus, Role } from "../domain/enums.js";
import { createApp } from "../app.js";
import type { AppContainer } from "../container.js";
import { AuthController } from "../controllers/auth.controller.js";
import { ArticleController } from "../controllers/article.controller.js";
import { AuthorDashboardController } from "../controllers/author-dashboard.controller.js";
import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  createRoleMiddleware,
} from "../middleware/auth.middleware.js";
import type {
  CreateArticleInput,
  IArticleRepository,
  IDailyAnalyticsRepository,
  IReadLogRepository,
  IUserRepository,
  UpdateArticleInput,
} from "../repositories/interfaces/index.js";
import { createApiRouter } from "../routes/index.js";
import type { IPasswordHasher } from "../security/password-hasher.js";
import { JwtTokenService } from "../security/jwt-token.service.js";
import { AnalyticsAggregationService } from "../services/analytics-aggregation.service.js";
import { ArticleService } from "../services/article.service.js";
import { AuthService } from "../services/auth.service.js";
import { AuthorDashboardService } from "../services/author-dashboard.service.js";
import { ReadTrackingService } from "../services/read-tracking.service.js";
import type { AppEnv } from "../config/env.js";
import type { Pagination } from "../domain/types.js";

class InMemoryPasswordHasher implements IPasswordHasher {
  async hash(plain: string) {
    return `hash:${plain}`;
  }
  async verify(plain: string, hashed: string) {
    return hashed === `hash:${plain}`;
  }
}

class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, UserRecord>();

  async create(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }) {
    const user: UserRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.passwordHash,
      role: input.role,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
}

class InMemoryArticleRepository implements IArticleRepository {
  private articles = new Map<string, ArticleRecord>();

  async create(input: CreateArticleInput) {
    const article: ArticleRecord = {
      id: crypto.randomUUID(),
      title: input.title,
      content: input.content,
      category: input.category,
      status: input.status,
      authorId: input.authorId,
      createdAt: new Date(),
      deletedAt: null,
    };
    this.articles.set(article.id, article);
    return article;
  }

  async updateOwned(articleId: string, authorId: string, patch: UpdateArticleInput) {
    const current = this.articles.get(articleId);
    if (!current || current.authorId !== authorId || current.deletedAt) return null;
    const updated = { ...current, ...patch };
    this.articles.set(articleId, updated);
    return updated;
  }

  async softDeleteOwned(articleId: string, authorId: string) {
    const current = this.articles.get(articleId);
    if (!current || current.authorId !== authorId || current.deletedAt) return null;
    const updated = { ...current, deletedAt: new Date() };
    this.articles.set(articleId, updated);
    return updated;
  }

  async findById(id: string) {
    return this.articles.get(id) ?? null;
  }

  async findPublishedVisibleById(id: string) {
    const a = this.articles.get(id);
    if (!a || a.status !== ArticleStatus.Published || a.deletedAt) return null;
    return a;
  }

  private filterPublished(filters: {
    category?: string;
    authorNameContains?: string;
    titleContains?: string;
  }) {
    return [...this.articles.values()].filter((a) => {
      if (a.status !== ArticleStatus.Published || a.deletedAt) return false;
      if (filters.category && a.category !== filters.category) return false;
      if (filters.titleContains && !a.title.toLowerCase().includes(filters.titleContains.toLowerCase()))
        return false;
      return true;
    });
  }

  async countPublishedVisible(filters: {
    category?: string;
    authorNameContains?: string;
    titleContains?: string;
  }) {
    return this.filterPublished(filters).length;
  }

  async listPublishedVisible(
    filters: { category?: string; authorNameContains?: string; titleContains?: string },
    pagination: Pagination,
  ) {
    const all = this.filterPublished(filters);
    const start = (pagination.pageNumber - 1) * pagination.pageSize;
    return all.slice(start, start + pagination.pageSize);
  }

  async countByAuthor(authorId: string, options: { includeDeleted: boolean }) {
    return [...this.articles.values()].filter(
      (a) => a.authorId === authorId && (options.includeDeleted || !a.deletedAt),
    ).length;
  }

  async listByAuthor(authorId: string, options: { includeDeleted: boolean }, pagination: Pagination) {
    const all = [...this.articles.values()].filter(
      (a) => a.authorId === authorId && (options.includeDeleted || !a.deletedAt),
    );
    const start = (pagination.pageNumber - 1) * pagination.pageSize;
    return all.slice(start, start + pagination.pageSize);
  }

  async listDashboardArticles(authorId: string, pagination: Pagination) {
    const all = [...this.articles.values()].filter((a) => a.authorId === authorId && !a.deletedAt);
    const start = (pagination.pageNumber - 1) * pagination.pageSize;
    return all.slice(start, start + pagination.pageSize).map((a) => ({
      id: a.id,
      title: a.title,
      createdAt: a.createdAt,
    }));
  }

  async countDashboardArticles(authorId: string) {
    return [...this.articles.values()].filter((a) => a.authorId === authorId && !a.deletedAt).length;
  }
}

class InMemoryReadLogRepository implements IReadLogRepository {
  logs: { articleId: string; readerId: string | null; readerIp?: string | null; readAt: Date }[] = [];

  async create(params: { articleId: string; readerId: string | null; readerIp?: string | null }) {
    this.logs.push({ ...params, readAt: new Date() });
  }

  async hasRecentRead(params: {
    articleId: string;
    readerId?: string | null;
    readerIp?: string | null;
    since: Date;
  }) {
    return this.logs.some((l) => {
      const matchId = params.readerId ? l.readerId === params.readerId : true;
      const matchIp = params.readerIp ? l.readerIp === params.readerIp : true;
      return l.articleId === params.articleId && l.readAt >= params.since && matchId && matchIp;
    });
  }

  async countGroupedByArticleForInterval(params: { start: Date; end: Date }) {
    const map = new Map<string, number>();
    for (const log of this.logs) {
      if (log.readAt >= params.start && log.readAt < params.end) {
        map.set(log.articleId, (map.get(log.articleId) ?? 0) + 1);
      }
    }
    return [...map.entries()].map(([articleId, count]) => ({ articleId, count }));
  }
}

class InMemoryDailyAnalyticsRepository implements IDailyAnalyticsRepository {
  rows: { articleId: string; date: Date; viewCount: number }[] = [];

  async upsertViewCount(articleId: string, date: Date, viewCount: number) {
    const idx = this.rows.findIndex(
      (r) => r.articleId === articleId && r.date.getTime() === date.getTime(),
    );
    if (idx >= 0) this.rows[idx] = { articleId, date, viewCount };
    else this.rows.push({ articleId, date, viewCount });
  }

  async sumViewsForArticles(articleIds: string[]) {
    const map = new Map<string, number>();
    for (const id of articleIds) {
      const total = this.rows.filter((r) => r.articleId === id).reduce((s, r) => s + r.viewCount, 0);
      map.set(id, total);
    }
    return map;
  }
}

const testEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 0,
  DATABASE_URL: "postgresql://test",
  JWT_SECRET: "test-secret-key-123456",
  JWT_EXPIRES_IN: "24h",
  READ_DEDUP_SECONDS: 60,
};

export type TestHarness = {
  app: express.Application;
  users: InMemoryUserRepository;
  articles: InMemoryArticleRepository;
  readLogs: InMemoryReadLogRepository;
  daily: InMemoryDailyAnalyticsRepository;
  aggregation: AnalyticsAggregationService;
  tokens: JwtTokenService;
};

export function createTestHarness(): TestHarness {
  const users = new InMemoryUserRepository();
  const articles = new InMemoryArticleRepository();
  const readLogs = new InMemoryReadLogRepository();
  const daily = new InMemoryDailyAnalyticsRepository();

  const passwords = new InMemoryPasswordHasher();
  const tokens = new JwtTokenService(testEnv);

  const authService = new AuthService(users, passwords, tokens);
  const articleService = new ArticleService(articles);
  const readTracking = new ReadTrackingService(readLogs, testEnv);
  const aggregation = new AnalyticsAggregationService(readLogs, daily);
  const dashboard = new AuthorDashboardService(articles, daily);

  const requireAuth = createAuthMiddleware(tokens);
  const optionalAuth = createOptionalAuthMiddleware(tokens);
  const requireAuthor = createRoleMiddleware([Role.author]);

  const apiRouter = createApiRouter({
    auth: new AuthController(authService),
    articles: new ArticleController(articleService, readTracking, articles),
    dashboard: new AuthorDashboardController(dashboard),
    guards: { requireAuth, optionalAuth, requireAuthor },
  });

  const container = {
    env: testEnv,
    prisma: {} as AppContainer["prisma"],
    apiRouter,
    analyticsScheduler: {
      start: async () => {},
      stop: async () => {},
      enqueueDay: async () => {},
    },
    shutdown: async () => {},
  } satisfies AppContainer;

  return { app: createApp(container), users, articles, readLogs, daily, aggregation, tokens };
}
