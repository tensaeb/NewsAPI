import type { ArticleRecord, UserRecord } from "../../domain/entities.js";
import type { ArticleStatus, Role } from "../../domain/enums.js";
import type { Pagination } from "../../domain/types.js";

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export interface IUserRepository {
  create(input: CreateUserInput): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export type CreateArticleInput = {
  title: string;
  content: string;
  category: string;
  status: ArticleStatus;
  authorId: string;
};

export type UpdateArticleInput = {
  title?: string;
  content?: string;
  category?: string;
  status?: ArticleStatus;
};

export interface IArticleRepository {
  create(input: CreateArticleInput): Promise<ArticleRecord>;
  updateOwned(articleId: string, authorId: string, patch: UpdateArticleInput): Promise<ArticleRecord | null>;
  softDeleteOwned(articleId: string, authorId: string): Promise<ArticleRecord | null>;
  findById(id: string): Promise<ArticleRecord | null>;
  findPublishedVisibleById(id: string): Promise<ArticleRecord | null>;
  countPublishedVisible(filters: {
    category?: string;
    authorNameContains?: string;
    titleContains?: string;
  }): Promise<number>;
  listPublishedVisible(
    filters: {
      category?: string;
      authorNameContains?: string;
      titleContains?: string;
    },
    pagination: Pagination,
  ): Promise<ArticleRecord[]>;
  countByAuthor(authorId: string, options: { includeDeleted: boolean }): Promise<number>;
  listByAuthor(
    authorId: string,
    options: { includeDeleted: boolean },
    pagination: Pagination,
  ): Promise<ArticleRecord[]>;
  listDashboardArticles(
    authorId: string,
    pagination: Pagination,
  ): Promise<Pick<ArticleRecord, "id" | "title" | "createdAt">[]>;
  countDashboardArticles(authorId: string): Promise<number>;
}

export interface IReadLogRepository {
  create(params: { articleId: string; readerId: string | null; readerIp?: string | null }): Promise<void>;
  hasRecentRead(params: {
    articleId: string;
    readerId?: string | null;
    readerIp?: string | null;
    since: Date;
  }): Promise<boolean>;
  countGroupedByArticleForInterval(params: {
    start: Date;
    end: Date;
  }): Promise<{ articleId: string; count: number }[]>;
}

export interface IDailyAnalyticsRepository {
  upsertViewCount(articleId: string, date: Date, viewCount: number): Promise<void>;
  sumViewsForArticles(articleIds: string[]): Promise<Map<string, number>>;
}
