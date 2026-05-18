import { describe, expect, it } from "vitest";
import request from "supertest";
import { Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";

describe("GET /auth/me", () => {
  const harness = createTestHarness();

  it("returns profile for authenticated user", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Me User",
      email: "me@example.com",
      password: VALID_PASSWORD,
      role: Role.reader,
    });

    const loginRes = await request(harness.app).post("/auth/login").send({
      email: "me@example.com",
      password: VALID_PASSWORD,
    });
    const token = loginRes.body.Object.token;

    const res = await request(harness.app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.Object.user.email).toBe("me@example.com");
  });

  it("rejects request without token", async () => {
    const res = await request(harness.app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects request with invalid token", async () => {
    const res = await request(harness.app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });
});
