import type { IDailyAnalyticsRepository, IReadLogRepository } from "../repositories/interfaces/index.js";
import { parseUtcCalendarDay, utcRangeForCalendarDay } from "../utils/time.js";

export interface IAnalyticsAggregationService {
  aggregateReadLogsForGmtCalendarDay(dayISO: string): Promise<void>;
}

export class AnalyticsAggregationService implements IAnalyticsAggregationService {
  constructor(
    private readonly readLogs: IReadLogRepository,
    private readonly daily: IDailyAnalyticsRepository,
  ) {}

  async aggregateReadLogsForGmtCalendarDay(dayISO: string): Promise<void> {
    const day = parseUtcCalendarDay(dayISO);
    const { start, end } = utcRangeForCalendarDay(day);
    const grouped = await this.readLogs.countGroupedByArticleForInterval({ start, end });
    for (const row of grouped) {
      await this.daily.upsertViewCount(row.articleId, day, row.count);
    }
  }
}
