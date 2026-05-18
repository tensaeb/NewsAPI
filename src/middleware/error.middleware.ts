import type { NextFunction, Request, Response } from "express";
import { AppError } from "../http/errors.js";
import { failResponse } from "../http/responses.js";
import type { ZodError } from "zod";
import { formatZodError } from "../validation/schemas.js";

export function createErrorMiddleware(nodeEnv: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(
        failResponse(err.message, err.errors.length ? err.errors : [err.message]),
      );
    }

    if (isZodError(err)) {
      const messages = formatZodError(err);
      return res.status(400).json(failResponse("Validation failed", messages));
    }

    // eslint-disable-next-line no-console
    console.error("Unhandled error", nodeEnv === "development" ? err : { name: (err as Error)?.name });

    const body =
      nodeEnv === "production"
        ? failResponse("Internal server error", ["Unexpected error"])
        : failResponse("Internal server error", [(err as Error)?.message ?? "Unexpected error"]);

    return res.status(500).json(body);
  };
}

function isZodError(err: unknown): err is ZodError {
  return Boolean(err && typeof err === "object" && "issues" in err);
}
