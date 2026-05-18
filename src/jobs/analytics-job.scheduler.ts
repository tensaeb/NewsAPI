import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import type { PgPoolConfig } from "../config/database-connection.js";
import type { IAnalyticsAggregationService } from "../services/analytics-aggregation.service.js";
import { previousUtcCalendarDayISO } from "../utils/time.js";

export const DAILY_ANALYTICS_QUEUE = "daily-analytics-aggregation";

export type AggregateJobPayload = {
  dayISO: string;
};

export interface IAnalyticsJobScheduler {
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueueDay(dayISO: string): Promise<void>;
}

export class AnalyticsJobScheduler implements IAnalyticsJobScheduler {
  private boss: PgBoss | null = null;

  constructor(
    private readonly db: PgPoolConfig,
    private readonly aggregation: IAnalyticsAggregationService,
  ) {}

  async start(): Promise<void> {
    this.boss = new PgBoss({
      connectionString: this.db.connectionString,
      ...(this.db.ssl ? { ssl: this.db.ssl } : {}),
    });
    this.boss.on("error", (err: Error) => {
      // eslint-disable-next-line no-console
      console.error("pg-boss error", err);
    });
    await this.boss.start();

    await this.boss.createQueue(DAILY_ANALYTICS_QUEUE);

    await this.boss.work<AggregateJobPayload>(DAILY_ANALYTICS_QUEUE, async (jobs: Job<AggregateJobPayload>[]) => {
      for (const job of jobs) {
        const dayISO = job.data?.dayISO ?? previousUtcCalendarDayISO();
        await this.aggregation.aggregateReadLogsForGmtCalendarDay(dayISO);
      }
    });

    // Runs daily at 00:15 UTC (GMT) and aggregates the previous UTC calendar day.
    // Note: We don't pass dayISO in the static schedule payload because pg-boss
    // uses the initial payload for all subsequent runs.
    // Instead, the worker logic uses previousUtcCalendarDayISO() if dayISO is missing.
    await this.boss.schedule(DAILY_ANALYTICS_QUEUE, "15 0 * * *", {}, { tz: "UTC" });
  }

  async stop(): Promise<void> {
    if (this.boss) {
      await this.boss.stop({ graceful: true, timeout: 10_000 });
      this.boss = null;
    }
  }

  /** Manual trigger for operations or tests */
  async enqueueDay(dayISO: string): Promise<void> {
    if (!this.boss) throw new Error("Analytics scheduler is not started");
    await this.boss.send(DAILY_ANALYTICS_QUEUE, { dayISO });
  }
}
