ALTER TABLE "appSetting" ADD COLUMN "granolaApiKey" TEXT;
ALTER TABLE "appSetting" ADD COLUMN "granolaFolderId" TEXT;
ALTER TABLE "appSetting" ADD COLUMN "granolaScope" TEXT;
ALTER TABLE "appSetting" ADD COLUMN "granolaWebhookEndpointId" TEXT;
ALTER TABLE "appSetting" ADD COLUMN "granolaWebhookSecret" TEXT;
ALTER TABLE "appSetting" ADD COLUMN "granolaConnectedAt" TIMESTAMP(3);
ALTER TABLE "appSetting" ADD COLUMN "granolaLastSyncedAt" TIMESTAMP(3);
ALTER TABLE "appSetting" ADD COLUMN "granolaLastError" TEXT;
