INSERT INTO "fieldDefinition" (
	"id",
	"entity",
	"key",
	"label",
	"type",
	"agentFilled",
	"agentBrief",
	"required",
	"showOnSheet",
	"showOnTable",
	"position",
	"createdAt",
	"updatedAt"
)
VALUES (
	'oximy-deal-product',
	'DEAL',
	'oximy_product',
	'Product',
	'SELECT',
	false,
	NULL,
	true,
	true,
	true,
	COALESCE((SELECT MAX("position") + 1 FROM "fieldDefinition" WHERE "entity" = 'DEAL'), 0),
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
)
ON CONFLICT ("entity", "key") DO UPDATE SET
	"label" = EXCLUDED."label",
	"type" = EXCLUDED."type",
	"agentFilled" = EXCLUDED."agentFilled",
	"agentBrief" = EXCLUDED."agentBrief",
	"required" = EXCLUDED."required",
	"showOnSheet" = EXCLUDED."showOnSheet",
	"showOnTable" = EXCLUDED."showOnTable",
	"archivedAt" = NULL,
	"updatedAt" = CURRENT_TIMESTAMP;

UPDATE "fieldOption"
SET "archivedAt" = CURRENT_TIMESTAMP
WHERE "fieldId" = (
	SELECT "id"
	FROM "fieldDefinition"
	WHERE "entity" = 'DEAL' AND "key" = 'oximy_product'
)
AND "id" NOT IN (
	'oximy-product-visibility',
	'oximy-product-relay',
	'oximy-product-sidekick'
);

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
VALUES
	('oximy-product-visibility', (SELECT "id" FROM "fieldDefinition" WHERE "entity" = 'DEAL' AND "key" = 'oximy_product'), 'Visibility', 0),
	('oximy-product-relay', (SELECT "id" FROM "fieldDefinition" WHERE "entity" = 'DEAL' AND "key" = 'oximy_product'), 'Relay', 1),
	('oximy-product-sidekick', (SELECT "id" FROM "fieldDefinition" WHERE "entity" = 'DEAL' AND "key" = 'oximy_product'), 'Sidekick', 2)
ON CONFLICT ("id") DO UPDATE SET
	"fieldId" = EXCLUDED."fieldId",
	"label" = EXCLUDED."label",
	"position" = EXCLUDED."position",
	"archivedAt" = NULL;

UPDATE "fieldValue" AS value
SET "optionId" = CASE option."label"
	WHEN 'Visibility' THEN 'oximy-product-visibility'
	WHEN 'Relay' THEN 'oximy-product-relay'
	WHEN 'Sidekick' THEN 'oximy-product-sidekick'
END
FROM "fieldOption" AS option
WHERE value."optionId" = option."id"
AND value."fieldId" = (
	SELECT "id"
	FROM "fieldDefinition"
	WHERE "entity" = 'DEAL' AND "key" = 'oximy_product'
)
AND option."label" IN ('Visibility', 'Relay', 'Sidekick');
