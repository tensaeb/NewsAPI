import type { NextFunction, Request, Response } from "express";
import type { IAuthorDashboardService } from "../services/author-dashboard.service.js";
import { paginatedOk } from "../http/responses.js";
import { paginationQuerySchema, parseRequest } from "../validation/schemas.js";

export class AuthorDashboardController {
  constructor(private readonly dashboard: IAuthorDashboardService) {}

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new Error("Auth context missing");
      const query = parseRequest(paginationQuerySchema, req.query);
      const { rows, total } = await this.dashboard.getDashboard({
        authorId: req.auth.sub,
        pagination: { pageNumber: query.pageNumber, pageSize: query.pageSize },
      });
      res.status(200).json(
        paginatedOk("Author dashboard", rows, query.pageNumber, query.pageSize, total),
      );
    } catch (err) {
      next(err);
    }
  };
}
