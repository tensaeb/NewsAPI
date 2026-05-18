/** Application enums — kept in domain layer (stable types without generated Prisma client). */
export const Role = {
  author: "author",
  reader: "reader",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ArticleStatus = {
  Draft: "Draft",
  Published: "Published",
} as const;

export type ArticleStatus = (typeof ArticleStatus)[keyof typeof ArticleStatus];
