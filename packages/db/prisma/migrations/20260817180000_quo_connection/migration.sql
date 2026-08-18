ALTER TYPE "ActivityType" ADD VALUE 'MESSAGE';

CREATE TYPE "CommunicationKind" AS ENUM ('CALL', 'MESSAGE');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CommunicationMatchStatus" AS ENUM ('NEEDS_REVIEW', 'MATCHED', 'IGNORED');
CREATE TYPE "CommunicationParticipantRole" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "CommunicationArtifactType" AS ENUM ('RECORDING', 'VOICEMAIL', 'SUMMARY', 'NEXT_STEPS', 'TRANSCRIPT');
CREATE TYPE "ContactPhoneSource" AS ENUM ('CRM', 'QUO', 'MANUAL');

CREATE TABLE "contactPhone" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "label" TEXT,
    "providerContactId" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "source" "ContactPhoneSource" NOT NULL DEFAULT 'CRM',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contactPhone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalConversationId" TEXT,
    "kind" "CommunicationKind" NOT NULL,
    "direction" "CommunicationDirection",
    "status" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationSeconds" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "providerPhoneNumberId" TEXT,
    "providerUserId" TEXT,
    "matchStatus" "CommunicationMatchStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "communication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communicationParticipant" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "role" "CommunicationParticipantRole" NOT NULL,
    "phoneE164" TEXT,
    "providerContactId" TEXT,
    "displayName" TEXT,
    "contactId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "communicationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communicationArtifact" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "type" "CommunicationArtifactType" NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'primary',
    "text" TEXT,
    "payload" JSONB,
    "sourceUrl" TEXT,
    "storedUrl" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "communicationArtifact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "activity" ADD COLUMN "communicationId" TEXT;

CREATE UNIQUE INDEX "contactPhone_contactId_e164_key" ON "contactPhone"("contactId", "e164");
CREATE INDEX "contactPhone_e164_idx" ON "contactPhone"("e164");
CREATE INDEX "contactPhone_providerContactId_idx" ON "contactPhone"("providerContactId");
CREATE UNIQUE INDEX "communication_provider_externalId_key" ON "communication"("provider", "externalId");
CREATE INDEX "communication_externalConversationId_idx" ON "communication"("externalConversationId");
CREATE INDEX "communication_kind_occurredAt_idx" ON "communication"("kind", "occurredAt");
CREATE INDEX "communication_matchStatus_occurredAt_idx" ON "communication"("matchStatus", "occurredAt");
CREATE INDEX "communication_createdById_occurredAt_idx" ON "communication"("createdById", "occurredAt");
CREATE UNIQUE INDEX "communicationParticipant_communicationId_role_phoneE164_key" ON "communicationParticipant"("communicationId", "role", "phoneE164");
CREATE INDEX "communicationParticipant_phoneE164_idx" ON "communicationParticipant"("phoneE164");
CREATE INDEX "communicationParticipant_contactId_communicationId_idx" ON "communicationParticipant"("contactId", "communicationId");
CREATE INDEX "communicationParticipant_userId_communicationId_idx" ON "communicationParticipant"("userId", "communicationId");
CREATE UNIQUE INDEX "communicationArtifact_communicationId_type_key_key" ON "communicationArtifact"("communicationId", "type", "key");
CREATE INDEX "communicationArtifact_type_createdAt_idx" ON "communicationArtifact"("type", "createdAt");
CREATE UNIQUE INDEX "activity_communicationId_key" ON "activity"("communicationId");

ALTER TABLE "contactPhone" ADD CONSTRAINT "contactPhone_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication" ADD CONSTRAINT "communication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communicationParticipant" ADD CONSTRAINT "communicationParticipant_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communicationParticipant" ADD CONSTRAINT "communicationParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communicationParticipant" ADD CONSTRAINT "communicationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communicationArtifact" ADD CONSTRAINT "communicationArtifact_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity" ADD CONSTRAINT "activity_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "contactPhone" ("id", "contactId", "value", "e164", "primary", "source", "createdAt", "updatedAt")
SELECT CONCAT('phone_', "id"), "id", "phone",
  CASE
    WHEN REGEXP_REPLACE("phone", '[^0-9]', '', 'g') ~ '^1[0-9]{10}$' THEN CONCAT('+', REGEXP_REPLACE("phone", '[^0-9]', '', 'g'))
    WHEN REGEXP_REPLACE("phone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$' THEN CONCAT('+1', REGEXP_REPLACE("phone", '[^0-9]', '', 'g'))
    WHEN "phone" LIKE '+%' AND LENGTH(REGEXP_REPLACE("phone", '[^0-9]', '', 'g')) >= 8 THEN CONCAT('+', REGEXP_REPLACE("phone", '[^0-9]', '', 'g'))
    ELSE CONCAT('unparsed:', "id")
  END,
  true, 'CRM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "contact"
WHERE "phone" IS NOT NULL AND BTRIM("phone") <> '';

ALTER TABLE "appSetting"
ADD COLUMN "quoApiKey" TEXT,
ADD COLUMN "quoWebhookId" TEXT,
ADD COLUMN "quoWebhookSecret" TEXT,
ADD COLUMN "quoPhoneNumbers" JSONB,
ADD COLUMN "quoUsers" JSONB,
ADD COLUMN "quoConnectedAt" TIMESTAMP(3),
ADD COLUMN "quoLastSyncedAt" TIMESTAMP(3),
ADD COLUMN "quoLastError" TEXT;

CREATE TABLE "quoWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quoWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quoWebhookEvent_processedAt_idx" ON "quoWebhookEvent"("processedAt");
