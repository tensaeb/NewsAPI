import type { PrismaClient } from "@prisma/client";
import type { Role as PrismaRole } from "@prisma/client";
import type { UserRecord } from "../../domain/entities.js";
import type { CreateUserInput, IUserRepository } from "../interfaces/index.js";

function toUserRecord(row: {
  id: string;
  name: string;
  email: string;
  password: string;
  role: PrismaRole;
  createdAt: Date;
}): UserRecord {
  return { ...row, role: row.role as UserRecord["role"] };
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateUserInput) {
    const row = await this.db.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        password: input.passwordHash,
        role: input.role as PrismaRole,
      },
    });
    return toUserRecord(row);
  }

  async findByEmail(email: string) {
    const row = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? toUserRecord(row) : null;
  }

  async findById(id: string) {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUserRecord(row) : null;
  }
}
