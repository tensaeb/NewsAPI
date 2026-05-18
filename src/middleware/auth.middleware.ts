import type { NextFunction, Request, Response } from "express";
import type { Role } from "../domain/enums.js";
import { ForbiddenError, UnauthorizedError } from "../http/errors.js";
import type { ITokenService } from "../security/token.service.js";

export function createAuthMiddleware(tokens: ITokenService) {
  return function requireAuth(req: Request, _res: Response, next: NextFunction) {
    try {
      const header = req.header("authorization");
      if (!header?.toLowerCase().startsWith("bearer ")) {
        throw new UnauthorizedError("Missing bearer token");
      }
      const raw = header.slice("bearer ".length).trim();
      if (!raw) throw new UnauthorizedError("Missing bearer token");
      req.auth = tokens.verify(raw);
      next();
    } catch (err) {
      next(err instanceof UnauthorizedError ? err : new UnauthorizedError("Invalid token"));
    }
  };
}

export function createOptionalAuthMiddleware(tokens: ITokenService) {
  return function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    try {
      const header = req.header("authorization");
      if (!header?.toLowerCase().startsWith("bearer ")) return next();
      const raw = header.slice("bearer ".length).trim();
      if (!raw) return next();
      req.auth = tokens.verify(raw);
      next();
    } catch {
      next();
    }
  };
}

export function createRoleMiddleware(allowed: Role[]) {
  return function requireRoles(req: Request, _res: Response, next: NextFunction) {
    if (!req.auth) return next(new UnauthorizedError("Missing bearer token"));
    if (!allowed.includes(req.auth.role)) {
      return next(new ForbiddenError("Forbidden"));
    }
    next();
  };
}
