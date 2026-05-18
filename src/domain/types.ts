import type { Role } from "./enums.js";

export type JwtClaims = {
  sub: string;
  role: Role;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
};

export type ArticlePayload = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  authorId: string;
  createdAt: Date;
  deletedAt: Date | null;
};

export type DashboardRow = {
  articleId: string;
  title: string;
  createdAt: Date;
  totalViews: number;
};

export type Pagination = {
  pageNumber: number;
  pageSize: number;
};
