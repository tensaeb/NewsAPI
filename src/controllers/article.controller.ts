import type { NextFunction, Request, Response } from "express";
import type { IArticleService } from "../services/article.service.js";
import type { IReadTrackingService } from "../services/read-tracking.service.js";
import type { IArticleRepository } from "../repositories/interfaces/index.js";
import { failResponse, okResponse, paginatedOk } from "../http/responses.js";
import {
  createArticleBodySchema,
  myArticlesQuerySchema,
  parseRequest,
  publicArticleFeedQuerySchema,
  updateArticleBodySchema,
} from "../validation/schemas.js";
import { routeParam } from "../utils/route-param.js";

export class ArticleController {
  constructor(
    private readonly articles: IArticleService,
    private readonly readTracking: IReadTrackingService,
    private readonly articleRepo: IArticleRepository,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new Error("Auth context missing");
      const body = parseRequest(createArticleBodySchema, req.body);
      const article = await this.articles.create({
        authorId: req.auth.sub,
        ...body,
      });
      res.status(201).json(okResponse("Article created", { article }));
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new Error("Auth context missing");
      const query = parseRequest(myArticlesQuerySchema, req.query);
      const { items, total } = await this.articles.listMine({
        authorId: req.auth.sub,
        pagination: { pageNumber: query.pageNumber, pageSize: query.pageSize },
        includeDeleted: query.includeDeleted ?? false,
      });
      const mapped = items.map((a) => ({
        ...a,
        isDeleted: a.deletedAt !== null,
      }));
      res.status(200).json(
        paginatedOk("Your articles", mapped, query.pageNumber, query.pageSize, total),
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new Error("Auth context missing");
      const body = parseRequest(updateArticleBodySchema, req.body);
      const article = await this.articles.update({
        articleId: routeParam(req.params.id),
        authorId: req.auth.sub,
        ...body,
      });
      res.status(200).json(okResponse("Article updated", { article }));
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new Error("Auth context missing");
      const article = await this.articles.softDelete({
        articleId: routeParam(req.params.id),
        authorId: req.auth.sub,
      });
      res.status(200).json(okResponse("Article deleted", { article }));
    } catch (err) {
      next(err);
    }
  };

  listPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = parseRequest(publicArticleFeedQuerySchema, req.query);
      const { items, total } = await this.articles.listPublic({
        filters: {
          category: query.category,
          author: query.author,
          q: query.q,
        },
        pagination: { pageNumber: query.pageNumber, pageSize: query.pageSize },
      });
      res.status(200).json(
        paginatedOk("Published articles", items, query.pageNumber, query.pageSize, total),
      );
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const articleId = routeParam(req.params.id);
      const article = await this.articles.getPublishedForReader(articleId);
      if (!article) {
        const raw = await this.articleRepo.findById(articleId);
        if (!raw || raw.deletedAt) {
          res
            .status(404)
            .json(failResponse("News article no longer available", ["News article no longer available"]));
          return;
        }
        res.status(404).json(failResponse("Article not found", ["Article not found"]));
        return;
      }

      this.readTracking.enqueueRead({
        articleId: article.id,
        readerId: req.auth?.sub ?? null,
        readerIp: req.ip,
      });

      res.status(200).json(okResponse("Article", { article }));
    } catch (err) {
      next(err);
    }
  };
}
