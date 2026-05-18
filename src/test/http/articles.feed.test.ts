import { describe, expect, it } from "vitest";
import request from "supertest";
import { ArticleStatus, Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT = "This content is long enough to satisfy the minimum length requirement of fifty characters.";

describe("GET /articles (Public Feed)", () => {
  const harness = createTestHarness();

  it("lists only published and non-deleted articles", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Feeder",
      email: "feed@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const login = await request(harness.app).post("/auth/login").send({
      email: "feed@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    await request(harness.app).post("/articles").set("Authorization", `Bearer ${token}`)
      .send({ title: "Public 1", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Published });
    await request(harness.app).post("/articles").set("Authorization", `Bearer ${token}`)
      .send({ title: "Draft 1", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Draft });
    const p2 = await request(harness.app).post("/articles").set("Authorization", `Bearer ${token}`)
      .send({ title: "Deleted 1", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Published });
    await request(harness.app).delete(`/articles/${p2.body.Object.article.id}`).set("Authorization", `Bearer ${token}`);

    const res = await request(harness.app).get("/articles");
    expect(res.status).toBe(200);
    expect(res.body.Object.length).toBe(1);
    expect(res.body.Object[0].title).toBe("Public 1");
  });

  it("supports filtering by category", async () => {
    const res = await request(harness.app).get("/articles?category=Sports");
    expect(res.status).toBe(200);
    expect(res.body.Object.length).toBe(0);
  });

  it("supports keyword search in title", async () => {
    const res = await request(harness.app).get("/articles?q=Public");
    expect(res.status).toBe(200);
    expect(res.body.Object.length).toBe(1);
  });
});
