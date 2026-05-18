export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors: string[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConflictError extends AppError {
  constructor(errors: string[]) {
    super("Conflict", 409, errors);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, [message]);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, [message]);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, [message]);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(errors: string[]) {
    super("Validation failed", 400, errors);
    this.name = "ValidationError";
  }
}
