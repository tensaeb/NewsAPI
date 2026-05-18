import argon2 from "argon2";
import type { IPasswordHasher } from "./password-hasher.js";

export class Argon2PasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    try {
      return await argon2.verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
