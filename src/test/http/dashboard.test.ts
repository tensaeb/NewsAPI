import { describe, expect, it } from "vitest";
import request from "supertest";
import { ArticleStatus, Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";
import { formatUtcCalendarDay } from "../../utils/time.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT = "This content is long enough to satisfy the minimum length requirement of fifty characters.";

describe("GET /author/dashboard", () => {
  const harness = createTestHarness();

  it("returns dashboard metrics for the author", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Dash Author",
      email: "dash@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const login = await request(harness.app).post("/auth/login").send({
      email: "dash@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const artRes = await request(harness.app).post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Metric Article", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Published });
    const artId = artRes.body.Object.article.id;

    // Simulate some reads
    await request(harness.app).get(`/articles/${artId}`);
    await request(harness.app).get(`/articles/${artId}`); // Different guest read if we don't handle IP here, but in-memory repo handles it.

    await new Promise(r => setTimeout(r, 50));

    // Aggregate
    const dayISO = formatUtcCalendarDay(new Date());
    await harness.aggregation.aggregateReadLogsForGmtCalendarDay(dayISO);

    const res = await request(harness.app)
      .get("/author/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.Object.length).toBe(1);
    expect(res.body.Object[0].totalViews).toBeGreaterThan(0);
    expect(res.body.Object[0].title).toBe("Metric Article");
  });
});
