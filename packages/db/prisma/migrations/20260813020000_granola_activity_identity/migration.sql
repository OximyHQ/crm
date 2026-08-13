ALTER TABLE "activity" ADD COLUMN "granolaNoteId" TEXT;
ALTER TABLE "activity" ADD COLUMN "granolaUrl" TEXT;

CREATE UNIQUE INDEX "activity_granolaNoteId_key" ON "activity"("granolaNoteId");
