import { describe, expect, it } from "vitest";
import request from "supertest";
import { ArticleStatus, Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT = "This content is long enough to satisfy the minimum length requirement of fifty characters.";

describe("GET /articles/:id (Detail & Read Tracking)", () => {
  const harness = createTestHarness();

  it("returns published article and deduplicates reads for same reader", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Author Detail",
      email: "author-detail@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const authLogin = await request(harness.app).post("/auth/login").send({
      email: "author-detail@test.com",
      password: VALID_PASSWORD,
    });
    const artRes = await request(harness.app).post("/articles")
      .set("Authorization", `Bearer ${authLogin.body.Object.token}`)
      .send({ title: "Detail Test", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Published });
    const artId = artRes.body.Object.article.id;

    await request(harness.app).post("/auth/signup").send({
        name: "Reader Detail",
        email: "reader-detail@test.com",
        password: VALID_PASSWORD,
        role: Role.reader,
      });
    const readLogin = await request(harness.app).post("/auth/login").send({
        email: "reader-detail@test.com",
        password: VALID_PASSWORD,
    });
    const readerToken = readLogin.body.Object.token;

    // First read
    const res1 = await request(harness.app).get(`/articles/${artId}`).set("Authorization", `Bearer ${readerToken}`);
    expect(res1.status).toBe(200);

    // Second read (should be deduped)
    await request(harness.app).get(`/articles/${artId}`).set("Authorization", `Bearer ${readerToken}`);

    await new Promise(r => setTimeout(r, 50));

    const logs = harness.readLogs.logs.filter(l => l.articleId === artId);
    expect(logs.length).toBe(1);
    expect(logs[0].readerId).not.toBeNull();
  });

  it("returns 404 with custom message for soft-deleted article", async () => {
    const authLogin = await request(harness.app).post("/auth/login").send({
        email: "author-detail@test.com",
        password: VALID_PASSWORD,
    });
    const token = authLogin.body.Object.token;
    const artRes = await request(harness.app).post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Delete", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Published });
    const artId = artRes.body.Object.article.id;
    await request(harness.app).delete(`/articles/${artId}`).set("Authorization", `Bearer ${token}`);

    const res = await request(harness.app).get(`/articles/${artId}`);
    expect(res.status).toBe(404);
    expect(res.body.Message).toBe("News article no longer available");
  });
});
