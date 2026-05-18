import type { NextFunction, Request, Response } from "express";
import type { IAuthService } from "../services/auth.service.js";
import { okResponse } from "../http/responses.js";
import { loginBodySchema, parseRequest, signupBodySchema } from "../validation/schemas.js";

export class AuthController {
  constructor(private readonly auth: IAuthService) {}

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = parseRequest(signupBodySchema, req.body);
      const { user } = await this.auth.register(body);
      res.status(201).json(okResponse("Account created", { user }));
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = parseRequest(loginBodySchema, req.body);
      const { token, user } = await this.auth.login(body);
      res.status(200).json(okResponse("Login successful", { token, user }));
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new Error("Auth context missing");
      const user = await this.auth.getSafeProfile(req.auth.sub);
      res.status(200).json(okResponse("Profile", { user }));
    } catch (err) {
      next(err);
    }
  };
}
