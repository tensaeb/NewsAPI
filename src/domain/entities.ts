import type { ArticleStatus, Role } from "./enums.js";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  createdAt: Date;
};

export type ArticleRecord = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: ArticleStatus;
  authorId: string;
  createdAt: Date;
  deletedAt: Date | null;
};
