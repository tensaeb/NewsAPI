import { ArticleStatus } from "../domain/enums.js";
import { ForbiddenError, NotFoundError } from "../http/errors.js";
import type { IArticleRepository } from "../repositories/interfaces/index.js";
import type { ArticlePayload, Pagination } from "../domain/types.js";

export interface IArticleService {
  create(input: {
    authorId: string;
    title: string;
    content: string;
    category: string;
    status?: ArticleStatus;
  }): Promise<ArticlePayload>;
  update(input: {
    articleId: string;
    authorId: string;
    title?: string;
    content?: string;
    category?: string;
    status?: ArticleStatus;
  }): Promise<ArticlePayload>;
  softDelete(input: { articleId: string; authorId: string }): Promise<ArticlePayload>;
  listMine(input: {
    authorId: string;
    pagination: Pagination;
    includeDeleted: boolean;
  }): Promise<{ items: ArticlePayload[]; total: number }>;
  listPublic(input: {
    filters: { category?: string; author?: string; q?: string };
    pagination: Pagination;
  }): Promise<{ items: ArticlePayload[]; total: number }>;
  getPublishedForReader(articleId: string): Promise<ArticlePayload | null>;
}

function mapArticle(a: {
  id: string;
  title: string;
  content: string;
  category: string;
  status: ArticleStatus;
  authorId: string;
  createdAt: Date;
  deletedAt: Date | null;
}): ArticlePayload {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    category: a.category,
    status: a.status,
    authorId: a.authorId,
    createdAt: a.createdAt,
    deletedAt: a.deletedAt,
  };
}

export class ArticleService implements IArticleService {
  constructor(private readonly articles: IArticleRepository) {}

  async create(input: {
    authorId: string;
    title: string;
    content: string;
    category: string;
    status?: ArticleStatus;
  }): Promise<ArticlePayload> {
    const created = await this.articles.create({
      title: input.title,
      content: input.content,
      category: input.category,
      status: input.status ?? ArticleStatus.Draft,
      authorId: input.authorId,
    });
    return mapArticle(created);
  }

  async update(input: {
    articleId: string;
    authorId: string;
    title?: string;
    content?: string;
    category?: string;
    status?: ArticleStatus;
  }): Promise<ArticlePayload> {
    const updated = await this.articles.updateOwned(input.articleId, input.authorId, {
      title: input.title,
      content: input.content,
      category: input.category,
      status: input.status,
    });
    if (!updated) {
      const any = await this.articles.findById(input.articleId);
      if (!any) throw new NotFoundError("Article not found");
      if (any.authorId !== input.authorId) throw new ForbiddenError("Forbidden");
      throw new NotFoundError("Article not found");
    }
    return mapArticle(updated);
  }

  async softDelete(input: { articleId: string; authorId: string }): Promise<ArticlePayload> {
    const deleted = await this.articles.softDeleteOwned(input.articleId, input.authorId);
    if (!deleted) {
      const any = await this.articles.findById(input.articleId);
      if (!any) throw new NotFoundError("Article not found");
      if (any.authorId !== input.authorId) throw new ForbiddenError("Forbidden");
      throw new NotFoundError("Article not found");
    }
    return mapArticle(deleted);
  }

  async listMine(input: {
    authorId: string;
    pagination: Pagination;
    includeDeleted: boolean;
  }): Promise<{ items: ArticlePayload[]; total: number }> {
    const [items, total] = await Promise.all([
      this.articles.listByAuthor(input.authorId, { includeDeleted: input.includeDeleted }, input.pagination),
      this.articles.countByAuthor(input.authorId, { includeDeleted: input.includeDeleted }),
    ]);
    return { items: items.map(mapArticle), total };
  }

  async listPublic(input: {
    filters: { category?: string; author?: string; q?: string };
    pagination: Pagination;
  }): Promise<{ items: ArticlePayload[]; total: number }> {
    const filters = {
      category: input.filters.category,
      authorNameContains: input.filters.author,
      titleContains: input.filters.q,
    };
    const [items, total] = await Promise.all([
      this.articles.listPublishedVisible(filters, input.pagination),
      this.articles.countPublishedVisible(filters),
    ]);
    return { items: items.map(mapArticle), total };
  }

  async getPublishedForReader(articleId: string): Promise<ArticlePayload | null> {
    const found = await this.articles.findPublishedVisibleById(articleId);
    return found ? mapArticle(found) : null;
  }
}
