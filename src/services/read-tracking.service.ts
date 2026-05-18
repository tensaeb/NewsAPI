import type { IReadLogRepository } from "../repositories/interfaces/index.js";
import type { AppEnv } from "../config/env.js";

export interface IReadTrackingService {
  /**
   * Records a read without blocking the caller's execution flow.
   * Uses deduplication for authenticated readers within READ_DEDUP_SECONDS.
   */
  enqueueRead(params: { articleId: string; readerId: string | null }): void;
}

export class ReadTrackingService implements IReadTrackingService {
  constructor(
    private readonly readLogs: IReadLogRepository,
    private readonly env: Pick<AppEnv, "READ_DEDUP_SECONDS">,
  ) {}

  /**
   * Technical Trade-off: Non-blocking read tracking.
   * We use setImmediate to process the read log asynchronously.
   * This ensures the article content is served to the reader immediately
   * without waiting for database writes, maximizing API responsiveness.
   */
  enqueueRead(params: { articleId: string; readerId: string | null }): void {
    setImmediate(() => {
      void this.record(params).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Read log recording failed", err);
      });
    });
  }

  private async record(params: { articleId: string; readerId: string | null }) {
    const windowSeconds = this.env.READ_DEDUP_SECONDS;
    if (params.readerId && windowSeconds > 0) {
      const since = new Date(Date.now() - windowSeconds * 1000);
      const duplicate = await this.readLogs.hasRecentRead({
        articleId: params.articleId,
        readerId: params.readerId,
        since,
      });
      if (duplicate) return;
    }
    await this.readLogs.create({ articleId: params.articleId, readerId: params.readerId });
  }
}
