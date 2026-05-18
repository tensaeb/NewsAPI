import { describe, expect, it } from "vitest";
import request from "supertest";
import { Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT = "This content is long enough to satisfy the minimum length requirement of fifty characters.";

describe("PUT & DELETE /articles/:id", () => {
  const harness = createTestHarness();

  it("updates and then soft deletes an article", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Owner",
      email: "owner@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const login = await request(harness.app).post("/auth/login").send({
      email: "owner@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const createRes = await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Original", content: VALID_CONTENT, category: "Tech" });
    const artId = createRes.body.Object.article.id;

    const updateRes = await request(harness.app)
      .put(`/articles/${artId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Title" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.Object.article.title).toBe("Updated Title");

    const deleteRes = await request(harness.app)
      .delete(`/articles/${artId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.Object.article.deletedAt).not.toBeNull();
  });

  it("prevents updating another author's article", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Other Author",
      email: "other@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const otherLogin = await request(harness.app).post("/auth/login").send({
      email: "other@test.com",
      password: VALID_PASSWORD,
    });
    const otherToken = otherLogin.body.Object.token;

    // Let's create an article as owner explicitly here
    const ownerLogin = await request(harness.app).post("/auth/login").send({
        email: "owner@test.com",
        password: VALID_PASSWORD,
    });
    const ownerToken = ownerLogin.body.Object.token;
    const artRes = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Owner Article", content: VALID_CONTENT, category: "Tech" });
    const artId = artRes.body.Object.article.id;

    const res = await request(harness.app)
      .put(`/articles/${artId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ title: "Hijacked" });

    expect(res.status).toBe(403);
    expect(res.body.Message).toBe("Forbidden");
  });

  it("prevents deleting another author's article", async () => {
    const otherLogin = await request(harness.app).post("/auth/login").send({
        email: "other@test.com",
        password: VALID_PASSWORD,
    });
    const otherToken = otherLogin.body.Object.token;

    const ownerLogin = await request(harness.app).post("/auth/login").send({
        email: "owner@test.com",
        password: VALID_PASSWORD,
    });
    const ownerToken = ownerLogin.body.Object.token;
    const artRes = await request(harness.app)
        .post("/articles")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Delete Me", content: VALID_CONTENT, category: "Tech" });
    const artId = artRes.body.Object.article.id;

    const res = await request(harness.app)
      .delete(`/articles/${artId}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.Message).toBe("Forbidden");
  });
});
