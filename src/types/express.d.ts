import type { Request } from "express";
import type { JwtClaims } from "../domain/types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtClaims;
    }
  }
}

export {};
