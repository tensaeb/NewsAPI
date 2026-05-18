import { z } from "zod";
import { ArticleStatus, Role } from "../domain/enums.js";

export const signupBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(120)
    .regex(/^[a-zA-Z\s]+$/, "Name must contain only letters and spaces"),
  email: z.string().email("Email must be valid"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character"),
  role: z.enum([Role.author, Role.reader], { message: "Role is required" }),
});

export const loginBodySchema = z.object({
  email: z.string().email("Email must be valid"),
  password: z.string().min(1, "Password is required"),
});

export const createArticleBodySchema = z.object({
  title: z.string().min(1).max(150, "Title may be at most 150 characters"),
  content: z.string().min(50, "Content must be at least 50 characters"),
  category: z.string().min(1, "Category is required"),
  status: z.enum([ArticleStatus.Draft, ArticleStatus.Published]).optional(),
});

export const updateArticleBodySchema = z.object({
  title: z.string().min(1).max(150).optional(),
  content: z.string().min(50).optional(),
  category: z.string().min(1).optional(),
  status: z.enum([ArticleStatus.Draft, ArticleStatus.Published]).optional(),
});

export const paginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const publicArticleFeedQuerySchema = paginationQuerySchema.extend({
  category: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
});

export const myArticlesQuerySchema = paginationQuerySchema.extend({
  includeDeleted: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

export function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((i) => i.message);
}
