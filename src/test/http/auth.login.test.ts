import { describe, expect, it } from "vitest";
import request from "supertest";
import { Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";

describe("POST /auth/login", () => {
  const harness = createTestHarness();

  it("successfully logs in with correct credentials", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Login User",
      email: "login@example.com",
      password: VALID_PASSWORD,
      role: Role.reader,
    });

    const res = await request(harness.app).post("/auth/login").send({
      email: "login@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.Object.token).toBeDefined();
    expect(res.body.Object.user.role).toBe(Role.reader);
  });

  it("fails login with wrong password", async () => {
    const res = await request(harness.app).post("/auth/login").send({
      email: "login@example.com",
      password: "wrong-password",
    });

    expect(res.status).toBe(401);
    expect(res.body.Message).toBe("Invalid credentials");
  });

  it("fails login with non-existent email", async () => {
    const res = await request(harness.app).post("/auth/login").send({
      email: "nobody@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(401);
  });
});
