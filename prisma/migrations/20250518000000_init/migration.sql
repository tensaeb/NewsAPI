-- CreateEnum
CREATE TYPE "Role" AS ENUM ('author', 'reader');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('Draft', 'Published');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'Draft',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadLog" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "readerId" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAnalytics" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "DailyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Article_status_deletedAt_idx" ON "Article"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Article_authorId_deletedAt_idx" ON "Article"("authorId", "deletedAt");

-- CreateIndex
CREATE INDEX "Article_category_status_deletedAt_idx" ON "Article"("category", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "ReadLog_articleId_readAt_idx" ON "ReadLog"("articleId", "readAt");

-- CreateIndex
CREATE INDEX "ReadLog_readerId_articleId_readAt_idx" ON "ReadLog"("readerId", "articleId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAnalytics_articleId_date_key" ON "DailyAnalytics"("articleId", "date");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadLog" ADD CONSTRAINT "ReadLog_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadLog" ADD CONSTRAINT "ReadLog_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAnalytics" ADD CONSTRAINT "DailyAnalytics_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
