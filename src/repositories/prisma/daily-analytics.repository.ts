import type { PrismaClient } from "@prisma/client";
import type { IDailyAnalyticsRepository } from "../interfaces/index.js";

export class PrismaDailyAnalyticsRepository implements IDailyAnalyticsRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsertViewCount(articleId: string, date: Date, viewCount: number) {
    await this.db.dailyAnalytics.upsert({
      where: {
        articleId_date: { articleId, date },
      },
      create: {
        articleId,
        date,
        viewCount,
      },
      update: {
        viewCount,
      },
    });
  }

  async sumViewsForArticles(articleIds: string[]) {
    if (articleIds.length === 0) return new Map<string, number>();
    const grouped = await this.db.dailyAnalytics.groupBy({
      by: ["articleId"],
      where: { articleId: { in: articleIds } },
      _sum: { viewCount: true },
    });
    const map = new Map<string, number>();
    for (const row of grouped) {
      map.set(row.articleId, row._sum.viewCount ?? 0);
    }
    return map;
  }
}
