import jwt from "jsonwebtoken";
import type { JwtClaims } from "../domain/types.js";
import type { ITokenService } from "./token.service.js";
import type { AppEnv } from "../config/env.js";

export class JwtTokenService implements ITokenService {
  constructor(private readonly env: Pick<AppEnv, "JWT_SECRET" | "JWT_EXPIRES_IN">) {}

  sign(claims: JwtClaims): string {
    return jwt.sign({ sub: claims.sub, role: claims.role }, this.env.JWT_SECRET, {
      expiresIn: this.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }

  verify(token: string): JwtClaims {
    const decoded = jwt.verify(token, this.env.JWT_SECRET) as jwt.JwtPayload & JwtClaims;
    const sub = decoded.sub;
    const role = decoded.role;
    if (!sub || !role) {
      throw new Error("Invalid token payload");
    }
    return { sub, role };
  }
}
