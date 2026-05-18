import type { UserRecord } from "../domain/entities.js";
import type { Role } from "../domain/enums.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../http/errors.js";
import type { IUserRepository } from "../repositories/interfaces/index.js";
import type { SafeUser } from "../domain/types.js";
import type { IPasswordHasher } from "../security/password-hasher.js";
import type { ITokenService } from "../security/token.service.js";

export interface IAuthService {
  register(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }): Promise<{ user: SafeUser }>;
  login(input: { email: string; password: string }): Promise<{ token: string; user: SafeUser }>;
  getSafeProfile(userId: string): Promise<SafeUser>;
}

function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export class AuthService implements IAuthService {
  constructor(
    private readonly users: IUserRepository,
    private readonly passwords: IPasswordHasher,
    private readonly tokens: ITokenService,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }): Promise<{ user: SafeUser }> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(["Email is already registered"]);
    }
    const hash = await this.passwords.hash(input.password);
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: hash,
      role: input.role,
    });
    return { user: toSafeUser(user) };
  }

  async login(input: { email: string; password: string }): Promise<{ token: string; user: SafeUser }> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const valid = await this.passwords.verify(input.password, user.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const token = this.tokens.sign({ sub: user.id, role: user.role });
    return { token, user: toSafeUser(user) };
  }

  async getSafeProfile(userId: string): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    return toSafeUser(user);
  }
}
