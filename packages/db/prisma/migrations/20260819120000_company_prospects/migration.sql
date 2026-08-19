-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('SUGGESTED', 'ADDED', 'DISMISSED');

-- CreateTable
CREATE TABLE "companyProspect" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "linkedinUrl" TEXT,
    "connectionsCount" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL,
    "orgFunction" TEXT NOT NULL,
    "seniorityRank" INTEGER NOT NULL,
    "profileAsOf" TIMESTAMP(3),
    "status" "ProspectStatus" NOT NULL DEFAULT 'SUGGESTED',
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companyProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companyProspect_contactId_key" ON "companyProspect"("contactId");

-- CreateIndex
CREATE INDEX "companyProspect_companyId_status_idx" ON "companyProspect"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "companyProspect_companyId_personId_key" ON "companyProspect"("companyId", "personId");

-- AddForeignKey
ALTER TABLE "companyProspect" ADD CONSTRAINT "companyProspect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companyProspect" ADD CONSTRAINT "companyProspect_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

