import type { PrismaClient } from "@prisma/client";
import type { IReadLogRepository } from "../interfaces/index.js";

export class PrismaReadLogRepository implements IReadLogRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(params: { articleId: string; readerId: string | null; readerIp?: string | null }) {
    await this.db.readLog.create({
      data: {
        articleId: params.articleId,
        readerId: params.readerId,
        readerIp: params.readerIp,
      },
    });
  }

  async hasRecentRead(params: {
    articleId: string;
    readerId?: string | null;
    readerIp?: string | null;
    since: Date;
  }) {
    const found = await this.db.readLog.findFirst({
      where: {
        articleId: params.articleId,
        readAt: { gte: params.since },
        readerId: params.readerId ?? null,
        ...(params.readerIp ? { readerIp: params.readerIp } : {}),
      },
      select: { id: true },
    });
    return Boolean(found);
  }

  async countGroupedByArticleForInterval(params: { start: Date; end: Date }) {
    const rows = await this.db.readLog.groupBy({
      by: ["articleId"],
      where: {
        readAt: {
          gte: params.start,
          lt: params.end,
        },
      },
      _count: { _all: true },
    });
    return rows.map((r) => ({ articleId: r.articleId, count: r._count._all }));
  }
}
