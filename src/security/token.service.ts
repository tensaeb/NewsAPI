import type { JwtClaims } from "../domain/types.js";

export interface ITokenService {
  sign(claims: JwtClaims): string;
  verify(token: string): JwtClaims;
}
