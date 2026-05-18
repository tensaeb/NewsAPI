import type { IArticleRepository, IDailyAnalyticsRepository } from "../repositories/interfaces/index.js";
import type { DashboardRow, Pagination } from "../domain/types.js";

export interface IAuthorDashboardService {
  getDashboard(input: { authorId: string; pagination: Pagination }): Promise<{
    rows: DashboardRow[];
    total: number;
  }>;
}

export class AuthorDashboardService implements IAuthorDashboardService {
  constructor(
    private readonly articles: IArticleRepository,
    private readonly daily: IDailyAnalyticsRepository,
  ) {}

  async getDashboard(input: { authorId: string; pagination: Pagination }) {
    const [rows, total] = await Promise.all([
      this.articles.listDashboardArticles(input.authorId, input.pagination),
      this.articles.countDashboardArticles(input.authorId),
    ]);
    const viewMap = await this.daily.sumViewsForArticles(rows.map((r) => r.id));

    const dashboard: DashboardRow[] = rows.map((r) => ({
      articleId: r.id,
      title: r.title,
      createdAt: r.createdAt,
      totalViews: viewMap.get(r.id) ?? 0,
    }));

    return { rows: dashboard, total };
  }
}
