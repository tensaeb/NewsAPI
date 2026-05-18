import { describe, expect, it } from "vitest";
import { createTestHarness } from "../test-app.js";
import { formatUtcCalendarDay, parseUtcCalendarDay } from "../../utils/time.js";

describe("Analytics Aggregation Job Logic", () => {
  const harness = createTestHarness();

  it("aggregates read logs into daily analytics correctly", async () => {
    const artId = "test-article-id";
    // Manually push logs to the in-memory repository
    harness.readLogs.logs.push(
      { articleId: artId, readerId: "u1", readerIp: "1.1.1.1", readAt: new Date() },
      { articleId: artId, readerId: "u2", readerIp: "2.2.2.2", readAt: new Date() }
    );

    const dayISO = formatUtcCalendarDay(new Date());
    await harness.aggregation.aggregateReadLogsForGmtCalendarDay(dayISO);

    const day = parseUtcCalendarDay(dayISO);
    const row = harness.daily.rows.find(
      (r) => r.articleId === artId && r.date.getTime() === day.getTime()
    );

    expect(row).toBeDefined();
    expect(row?.viewCount).toBe(2);
  });

  it("handles empty read logs for a day", async () => {
    const dayISO = "2020-01-01";
    await harness.aggregation.aggregateReadLogsForGmtCalendarDay(dayISO);
    const day = parseUtcCalendarDay(dayISO);
    const row = harness.daily.rows.find((r) => r.date.getTime() === day.getTime());
    expect(row).toBeUndefined();
  });
});
