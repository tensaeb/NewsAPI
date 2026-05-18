import { ArticleStatus as PrismaArticleStatus, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { ArticleRecord } from "../../domain/entities.js";
import { ArticleStatus } from "../../domain/enums.js";
import type {
  CreateArticleInput,
  IArticleRepository,
  UpdateArticleInput,
} from "../interfaces/index.js";
import type { Pagination } from "../../domain/types.js";

function toArticleRecord(row: {
  id: string;
  title: string;
  content: string;
  category: string;
  status: PrismaArticleStatus;
  authorId: string;
  createdAt: Date;
  deletedAt: Date | null;
}): ArticleRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    status: row.status as ArticleStatus,
    authorId: row.authorId,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  };
}

const publishedVisibleWhere = (
  filters: {
    category?: string;
    authorNameContains?: string;
    titleContains?: string;
  },
): Prisma.ArticleWhereInput => ({
  status: PrismaArticleStatus.Published,
  deletedAt: null,
  ...(filters.category ? { category: filters.category } : {}),
  ...(filters.authorNameContains
    ? {
        author: {
          name: { contains: filters.authorNameContains, mode: "insensitive" },
        },
      }
    : {}),
  ...(filters.titleContains
    ? { title: { contains: filters.titleContains, mode: "insensitive" } }
    : {}),
});

export class PrismaArticleRepository implements IArticleRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateArticleInput) {
    const row = await this.db.article.create({
      data: { ...input, status: input.status as PrismaArticleStatus },
    });
    return toArticleRecord(row);
  }

  async updateOwned(articleId: string, authorId: string, patch: UpdateArticleInput) {
    const existing = await this.db.article.findFirst({
      where: { id: articleId, authorId, deletedAt: null },
    });
    if (!existing) return null;
    const row = await this.db.article.update({
      where: { id: articleId },
      data: {
        ...patch,
        ...(patch.status ? { status: patch.status as PrismaArticleStatus } : {}),
      },
    });
    return toArticleRecord(row);
  }

  async softDeleteOwned(articleId: string, authorId: string) {
    const existing = await this.db.article.findFirst({
      where: { id: articleId, authorId, deletedAt: null },
    });
    if (!existing) return null;
    const row = await this.db.article.update({
      where: { id: articleId },
      data: { deletedAt: new Date() },
    });
    return toArticleRecord(row);
  }

  async findById(id: string) {
    const row = await this.db.article.findUnique({ where: { id } });
    return row ? toArticleRecord(row) : null;
  }

  async findPublishedVisibleById(id: string) {
    const row = await this.db.article.findFirst({
      where: { id, status: PrismaArticleStatus.Published, deletedAt: null },
    });
    return row ? toArticleRecord(row) : null;
  }

  async countPublishedVisible(filters: {
    category?: string;
    authorNameContains?: string;
    titleContains?: string;
  }) {
    return this.db.article.count({ where: publishedVisibleWhere(filters) });
  }

  async listPublishedVisible(
    filters: {
      category?: string;
      authorNameContains?: string;
      titleContains?: string;
    },
    pagination: Pagination,
  ) {
    const skip = (pagination.pageNumber - 1) * pagination.pageSize;
    const rows = await this.db.article.findMany({
      where: publishedVisibleWhere(filters),
      orderBy: { createdAt: "desc" },
      skip,
      take: pagination.pageSize,
    });
    return rows.map(toArticleRecord);
  }

  async countByAuthor(authorId: string, options: { includeDeleted: boolean }) {
    return this.db.article.count({
      where: {
        authorId,
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  async listByAuthor(
    authorId: string,
    options: { includeDeleted: boolean },
    pagination: Pagination,
  ) {
    const skip = (pagination.pageNumber - 1) * pagination.pageSize;
    const rows = await this.db.article.findMany({
      where: {
        authorId,
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pagination.pageSize,
    });
    return rows.map(toArticleRecord);
  }

  async listDashboardArticles(authorId: string, pagination: Pagination) {
    const skip = (pagination.pageNumber - 1) * pagination.pageSize;
    return this.db.article.findMany({
      where: { authorId, deletedAt: null },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pagination.pageSize,
    });
  }

  async countDashboardArticles(authorId: string) {
    return this.db.article.count({ where: { authorId, deletedAt: null } });
  }
}
