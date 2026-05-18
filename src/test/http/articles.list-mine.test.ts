import { describe, expect, it } from "vitest";
import request from "supertest";
import { ArticleStatus, Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT = "This content is long enough to satisfy the minimum length requirement of fifty characters.";

describe("GET /articles/me", () => {
  const harness = createTestHarness();

  it("lists articles for the authenticated author including drafts", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Author Mike",
      email: "mike@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const login = await request(harness.app).post("/auth/login").send({
      email: "mike@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Published", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Published });
    await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Draft", content: VALID_CONTENT, category: "Tech", status: ArticleStatus.Draft });

    const res = await request(harness.app)
      .get("/articles/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.Object.length).toBe(2);
    expect(res.body.Object.some((a: any) => a.status === ArticleStatus.Draft)).toBe(true);
    expect(res.body.TotalSize).toBe(2);
  });

  it("can include soft-deleted articles via query parameter", async () => {
    const login = await request(harness.app).post("/auth/login").send({
      email: "mike@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const list = await request(harness.app).get("/articles/me").set("Authorization", `Bearer ${token}`);
    const artId = list.body.Object[0].id;

    await request(harness.app).delete(`/articles/${artId}`).set("Authorization", `Bearer ${token}`);

    const resNormal = await request(harness.app).get("/articles/me").set("Authorization", `Bearer ${token}`);
    expect(resNormal.body.Object.length).toBe(1);

    const resAll = await request(harness.app).get("/articles/me?includeDeleted=true").set("Authorization", `Bearer ${token}`);
    expect(resAll.body.Object.length).toBe(2);
    expect(resAll.body.Object.find((a: any) => a.id === artId).isDeleted).toBe(true);
  });
});
