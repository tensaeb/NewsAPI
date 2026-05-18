import { describe, expect, it } from "vitest";
import request from "supertest";
import { Role } from "../../domain/enums.js";
import { createTestHarness } from "../test-app.js";

const VALID_PASSWORD = "Str0ng!pass";

describe("POST /auth/signup", () => {
  const harness = createTestHarness();

  it("successfully signs up a new author", async () => {
    const res = await request(harness.app).post("/auth/signup").send({
      name: "Ada Author",
      email: "ada@example.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    expect(res.status).toBe(201);
    expect(res.body.Success).toBe(true);
    expect(res.body.Object.user.email).toBe("ada@example.com");
  });

  it("rejects duplicate email with 409", async () => {
    await request(harness.app).post("/auth/signup").send({
      name: "Duplicate",
      email: "dup@example.com",
      password: VALID_PASSWORD,
      role: Role.reader,
    });
    const res = await request(harness.app).post("/auth/signup").send({
      name: "Duplicate Again",
      email: "dup@example.com",
      password: VALID_PASSWORD,
      role: Role.reader,
    });
    expect(res.status).toBe(409);
    expect(res.body.Errors).toContain("Email is already registered");
  });

  it("rejects invalid email format", async () => {
    const res = await request(harness.app).post("/auth/signup").send({
      name: "Bad Email",
      email: "not-an-email",
      password: VALID_PASSWORD,
      role: Role.reader,
    });
    expect(res.status).toBe(400);
    expect(res.body.Success).toBe(false);
  });

  it("rejects weak password", async () => {
    const res = await request(harness.app).post("/auth/signup").send({
      name: "Weak Pass",
      email: "weak@example.com",
      password: "123",
      role: Role.reader,
    });
    expect(res.status).toBe(400);
    expect(res.body.Errors).toContain("Password must be at least 8 characters");
  });

  it("rejects name with special characters", async () => {
    const res = await request(harness.app).post("/auth/signup").send({
      name: "Ada Author #1",
      email: "ada2@example.com",
      password: VALID_PASSWORD,
      role: Role.author,
    });
    expect(res.status).toBe(400);
    expect(res.body.Errors).toContain("Name must contain only letters and spaces");
  });
});
