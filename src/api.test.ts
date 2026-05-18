/**
 * HTTP integration tests — database mocked via in-memory repositories (see test/test-app.ts).
 * Covers all API routes required by the Afrolink assessment bonus criteria.
 */
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { ArticleStatus, Role } from "./domain/enums.js";
import { createTestHarness } from "./test/test-app.js";
import { formatUtcCalendarDay, parseUtcCalendarDay } from "./utils/time.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT =
  "This article has enough characters to satisfy the minimum content length rule.";

describe("News API — all HTTP routes (mocked database)", () => {
  const harness = createTestHarness();

  let authorToken = "";
  let otherAuthorToken = "";
  let readerToken = "";
  let articleId = "";

  beforeAll(async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Jane Author",
      email: "author@example.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    await request(harness.app).post("/auth/signup").send({
      name: "John Other",
      email: "other@example.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    await request(harness.app).post("/auth/signup").send({
      name: "Rita Reader",
      email: "reader@example.com",
      password: VALID_PASSWORD,
      role: Role.reader,
    });

    authorToken = (
      await request(harness.app).post("/auth/login").send({
        email: "author@example.com",
        password: VALID_PASSWORD,
      })
    ).body.Object.token;

    otherAuthorToken = (
      await request(harness.app).post("/auth/login").send({
        email: "other@example.com",
        password: VALID_PASSWORD,
      })
    ).body.Object.token;

    readerToken = (
      await request(harness.app).post("/auth/login").send({
        email: "reader@example.com",
        password: VALID_PASSWORD,
      })
    ).body.Object.token;
  });

  describe("GET /health", () => {
    it("returns healthy status", async () => {
      const res = await request(harness.app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.Success).toBe(true);
    });
  });

  describe("POST /auth/signup", () => {
    it("rejects duplicate email with 409", async () => {
      const res = await request(harness.app).post("/auth/signup").send({
        name: "Jane Author",
        email: "author@example.com",
        password: VALID_PASSWORD,
        role: Role.author,
      });
      expect(res.status).toBe(409);
      expect(res.body.Errors).toContain("Email is already registered");
    });
  });

  describe("POST /auth/login", () => {
    it("returns JWT on valid credentials", async () => {
      const res = await request(harness.app).post("/auth/login").send({
        email: "reader@example.com",
        password: VALID_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(res.body.Object.token).toBeTruthy();
      expect(res.body.Object.user.role).toBe(Role.reader);
    });

    it("returns 401 for invalid credentials", async () => {
      const res = await request(harness.app).post("/auth/login").send({
        email: "reader@example.com",
        password: "wrong-password",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns profile for authenticated user", async () => {
      const res = await request(harness.app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.Object.user.email).toBe("author@example.com");
    });
  });

  describe("POST /articles", () => {
    it("creates article as author", async () => {
      const res = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Breaking Tech News",
          content: VALID_CONTENT,
          category: "Tech",
          status: ArticleStatus.Published,
        });
      expect(res.status).toBe(201);
      articleId = res.body.Object.article.id;
    });

    it("forbids readers from creating articles", async () => {
      const res = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${readerToken}`)
        .send({
          title: "Reader attempt",
          content: VALID_CONTENT,
          category: "Tech",
        });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /articles", () => {
    it("lists published articles with pagination", async () => {
      const res = await request(harness.app).get("/articles?category=Tech&q=Breaking");
      expect(res.status).toBe(200);
      expect(res.body.Object.length).toBeGreaterThan(0);
      expect(res.body.PageNumber).toBe(1);
      expect(res.body.PageSize).toBe(10);
    });
  });

  describe("GET /articles/:id", () => {
    it("returns article and records read log for authenticated reader", async () => {
      const res = await request(harness.app)
        .get(`/articles/${articleId}`)
        .set("Authorization", `Bearer ${readerToken}`);
      expect(res.status).toBe(200);
      await new Promise((r) => setImmediate(r));
      expect(harness.readLogs.logs.length).toBeGreaterThan(0);
    });

    it("records guest read when no JWT is provided", async () => {
      const fresh = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Guest read probe",
          content: VALID_CONTENT,
          category: "Tech",
          status: ArticleStatus.Published,
        });
      const freshId = fresh.body.Object.article.id;
      const before = harness.readLogs.logs.length;
      const res = await request(harness.app).get(`/articles/${freshId}`);
      expect(res.status).toBe(200);
      await new Promise((r) => setImmediate(r));
      expect(harness.readLogs.logs.length).toBeGreaterThan(before);
      expect(harness.readLogs.logs.at(-1)?.readerId).toBeNull();
    });

    it("deduplicates rapid reads for the same logged-in reader", async () => {
      const created = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Dedup probe",
          content: VALID_CONTENT,
          category: "Health",
          status: ArticleStatus.Published,
        });
      const freshId = created.body.Object.article.id as string;
      const before = harness.readLogs.logs.length;

      await request(harness.app)
        .get(`/articles/${freshId}`)
        .set("Authorization", `Bearer ${readerToken}`);
      await request(harness.app)
        .get(`/articles/${freshId}`)
        .set("Authorization", `Bearer ${readerToken}`);
      await new Promise((r) => setTimeout(r, 30));

      expect(harness.readLogs.logs.length).toBe(before + 1);
    });

    it("deduplicates rapid reads for the same guest IP", async () => {
      const created = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Guest Dedup probe",
          content: VALID_CONTENT,
          category: "Health",
          status: ArticleStatus.Published,
        });
      const freshId = created.body.Object.article.id as string;
      const before = harness.readLogs.logs.length;

      // Mock IP is not easily set via supertest but we can test the service or rely on default behavior
      await request(harness.app).get(`/articles/${freshId}`);
      await request(harness.app).get(`/articles/${freshId}`);
      await new Promise((r) => setTimeout(r, 30));

      expect(harness.readLogs.logs.length).toBe(before + 1);
    });
  });

  describe("PUT /articles/:id", () => {
    it("updates own article", async () => {
      const res = await request(harness.app)
        .put(`/articles/${articleId}`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({ title: "Updated Tech Headline" });
      expect(res.status).toBe(200);
      expect(res.body.Object.article.title).toBe("Updated Tech Headline");
    });

    it("forbids editing another author's article", async () => {
      const res = await request(harness.app)
        .put(`/articles/${articleId}`)
        .set("Authorization", `Bearer ${otherAuthorToken}`)
        .send({ title: "Hijacked title" });
      expect(res.status).toBe(403);
      expect(res.body.Message).toBe("Forbidden");
    });
  });

  describe("DELETE /articles/:id", () => {
    it("soft deletes and hides article from public feed", async () => {
      const del = await request(harness.app)
        .delete(`/articles/${articleId}`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(del.status).toBe(200);

      const feed = await request(harness.app).get("/articles");
      expect(feed.body.Object.find((a: { id: string }) => a.id === articleId)).toBeUndefined();

      const detail = await request(harness.app).get(`/articles/${articleId}`);
      expect(detail.status).toBe(404);
      expect(detail.body.Message).toBe("News article no longer available");
    });
  });

  describe("GET /articles/me", () => {
    it("lists author articles including drafts", async () => {
      await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Draft piece",
          content: VALID_CONTENT,
          category: "Politics",
          status: ArticleStatus.Draft,
        });

      const res = await request(harness.app)
        .get("/articles/me")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.Object.some((a: { status: string }) => a.status === ArticleStatus.Draft)).toBe(
        true,
      );
    });
  });

  describe("GET /author/dashboard", () => {
    it("returns paginated dashboard with total views", async () => {
      const dayISO = formatUtcCalendarDay(new Date());
      await harness.aggregation.aggregateReadLogsForGmtCalendarDay(dayISO);

      const res = await request(harness.app)
        .get("/author/dashboard")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.Object.length).toBeGreaterThan(0);
      expect(res.body.Object[0]).toHaveProperty("totalViews");
    });
  });

  describe("Analytics aggregation (GMT)", () => {
    it("upserts daily analytics from read logs", async () => {
      const dayISO = formatUtcCalendarDay(new Date());
      await harness.aggregation.aggregateReadLogsForGmtCalendarDay(dayISO);
      const day = parseUtcCalendarDay(dayISO);
      const row = harness.daily.rows.find(
        (r) => r.articleId === articleId && r.date.getTime() === day.getTime(),
      );
      expect(row?.viewCount).toBeGreaterThan(0);
    });
  });
});
