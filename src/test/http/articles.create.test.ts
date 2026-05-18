import { describe, expect, it } from "vitest";
import request from "supertest";
import { ArticleStatus, Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";
const VALID_CONTENT = "This content is long enough to satisfy the minimum length requirement of fifty characters.";

describe("POST /articles", () => {
  const harness = createTestHarness();

  it("successfully creates a published article as an author", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Author Jane",
      email: "author@test.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    const login = await request(harness.app).post("/auth/login").send({
      email: "author@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const res = await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "New Innovations in Tech",
        content: VALID_CONTENT,
        category: "Tech",
        status: ArticleStatus.Published,
      });

    expect(res.status).toBe(201);
    expect(res.body.Object.article.title).toBe("New Innovations in Tech");
    expect(res.body.Object.article.status).toBe(ArticleStatus.Published);
  });

  it("defaults status to Draft if not provided", async () => {
    const login = await request(harness.app).post("/auth/login").send({
      email: "author@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const res = await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "A Draft Article",
        content: VALID_CONTENT,
        category: "General",
      });

    expect(res.status).toBe(201);
    expect(res.body.Object.article.status).toBe(ArticleStatus.Draft);
  });

  it("forbids readers from creating articles", async () => {
    const actualToken = harness.tokens.sign({ sub: "rita-id", role: Role.reader });

    const res = await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${actualToken}`)
      .send({
        title: "Reader attempt",
        content: VALID_CONTENT,
        category: "Tech",
      });

    expect(res.status).toBe(403);
    expect(res.body.Message).toBe("Forbidden");
  });

  it("rejects article with too short content", async () => {
    const login = await request(harness.app).post("/auth/login").send({
      email: "author@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const res = await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Short",
        content: "Too short",
        category: "Tech",
      });

    expect(res.status).toBe(400);
    expect(res.body.Errors).toContain("Content must be at least 50 characters");
  });

  it("rejects article with title too long", async () => {
    const login = await request(harness.app).post("/auth/login").send({
      email: "author@test.com",
      password: VALID_PASSWORD,
    });
    const token = login.body.Object.token;

    const res = await request(harness.app)
      .post("/articles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "A".repeat(151),
        content: VALID_CONTENT,
        category: "Tech",
      });

    expect(res.status).toBe(400);
    expect(res.body.Errors).toContain("Title may be at most 150 characters");
  });
});
