-- Rename companyProspect to companyPerson: discovered people are not yet
-- prospects in the sales sense. Data-preserving renames only.
ALTER TABLE "companyProspect" RENAME TO "companyPerson";
ALTER TYPE "ProspectStatus" RENAME TO "CompanyPersonStatus";
ALTER INDEX "companyProspect_pkey" RENAME TO "companyPerson_pkey";
ALTER INDEX "companyProspect_contactId_key" RENAME TO "companyPerson_contactId_key";
ALTER INDEX "companyProspect_companyId_status_idx" RENAME TO "companyPerson_companyId_status_idx";
ALTER INDEX "companyProspect_companyId_personId_key" RENAME TO "companyPerson_companyId_personId_key";
ALTER TABLE "companyPerson" RENAME CONSTRAINT "companyProspect_companyId_fkey" TO "companyPerson_companyId_fkey";
ALTER TABLE "companyPerson" RENAME CONSTRAINT "companyProspect_contactId_fkey" TO "companyPerson_contactId_fkey";
