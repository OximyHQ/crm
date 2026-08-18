import type { Db } from "./client";
import {
	DEFAULT_REPORTING_CURRENCY,
	isCurrencyCode,
	normalizeCurrency,
} from "./currency";
import { Prisma } from "./generated/prisma/client";

export const SETTINGS_ID = "app";

export const DEFAULT_AGENT_MODEL = {
	id: "zai/glm-5.2-fast",
	contextWindowTokens: 1_000_000,
} as const;

export interface AgentModelSetting {
	id: string;
	contextWindowTokens: number;
	isDefault: boolean;
}

export async function readAgentModel(db: Db): Promise<AgentModelSetting> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { agentModelId: true, agentModelContextWindow: true },
	});

	if (!row?.agentModelId) {
		return { ...DEFAULT_AGENT_MODEL, isDefault: true };
	}

	return {
		id: row.agentModelId,
		contextWindowTokens:
			row.agentModelContextWindow ?? DEFAULT_AGENT_MODEL.contextWindowTokens,
		isDefault: false,
	};
}

export async function writeAgentModel(
	db: Db,
	model: { id: string; contextWindowTokens: number } | null,
): Promise<void> {
	const fields = {
		agentModelId: model?.id ?? null,
		agentModelContextWindow: model?.contextWindowTokens ?? null,
	};

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...fields },
		update: fields,
	});
}

export const CONTEXT_DEV_SIGNUP_URL = "https://link.context.dev/crm";

export const CONTEXT_DEV_DISCOUNT_CODE = "CRM";

export async function readContextDevKey(db: Db): Promise<string | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { contextDevApiKey: true },
	});

	return row?.contextDevApiKey?.trim() || null;
}

export async function writeContextDevKey(db: Db, key: string): Promise<void> {
	const contextDevApiKey = key.trim();

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, contextDevApiKey },
		update: { contextDevApiKey },
	});
}

export async function readReportingCurrency(db: Db): Promise<string> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { reportingCurrency: true },
	});

	const stored = normalizeCurrency(row?.reportingCurrency);

	return isCurrencyCode(stored) ? stored : DEFAULT_REPORTING_CURRENCY;
}

export async function writeReportingCurrency(
	db: Db,
	code: string,
): Promise<string> {
	const reportingCurrency = normalizeCurrency(code);

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, reportingCurrency },
		update: { reportingCurrency },
	});

	return reportingCurrency;
}

export async function readRatesRefreshedAt(db: Db): Promise<Date | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { ratesRefreshedAt: true },
	});

	return row?.ratesRefreshedAt ?? null;
}

export async function writeRatesRefreshedAt(
	db: Db,
	ratesRefreshedAt: Date,
): Promise<void> {
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ratesRefreshedAt },
		update: { ratesRefreshedAt },
	});
}

export function maskKey(key: string): string {
	const trimmed = key.trim();
	return trimmed.length > 4 ? `••••${trimmed.slice(-4)}` : "••••";
}

export type GranolaScope = "personal" | "public";

export type GranolaConnection = {
	apiKey: string;
	folderId: string;
	scope: GranolaScope;
	webhookEndpointId: string;
	webhookSecret: string;
	connectedAt: Date;
};

export async function readGranolaConnection(
	db: Db,
): Promise<GranolaConnection | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			granolaApiKey: true,
			granolaFolderId: true,
			granolaScope: true,
			granolaWebhookEndpointId: true,
			granolaWebhookSecret: true,
			granolaConnectedAt: true,
		},
	});
	const scope = row?.granolaScope;
	if (
		!row?.granolaApiKey ||
		!row.granolaFolderId ||
		!row.granolaWebhookEndpointId ||
		!row.granolaWebhookSecret ||
		!row.granolaConnectedAt ||
		!isGranolaScope(scope)
	) {
		return null;
	}

	return {
		apiKey: row.granolaApiKey,
		folderId: row.granolaFolderId,
		scope,
		webhookEndpointId: row.granolaWebhookEndpointId,
		webhookSecret: row.granolaWebhookSecret,
		connectedAt: row.granolaConnectedAt,
	};
}

export async function writeGranolaConnection(
	db: Db,
	connection: Omit<GranolaConnection, "connectedAt">,
): Promise<void> {
	const fields = { ...connection, granolaConnectedAt: new Date() };

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: {
			id: SETTINGS_ID,
			granolaApiKey: fields.apiKey,
			granolaFolderId: fields.folderId,
			granolaScope: fields.scope,
			granolaWebhookEndpointId: fields.webhookEndpointId,
			granolaWebhookSecret: fields.webhookSecret,
			granolaConnectedAt: fields.granolaConnectedAt,
		},
		update: {
			granolaApiKey: fields.apiKey,
			granolaFolderId: fields.folderId,
			granolaScope: fields.scope,
			granolaWebhookEndpointId: fields.webhookEndpointId,
			granolaWebhookSecret: fields.webhookSecret,
			granolaConnectedAt: fields.granolaConnectedAt,
			granolaLastError: null,
		},
	});
}

export async function clearGranolaConnection(db: Db): Promise<void> {
	await db.appSetting.updateMany({
		where: { id: SETTINGS_ID },
		data: {
			granolaApiKey: null,
			granolaFolderId: null,
			granolaScope: null,
			granolaWebhookEndpointId: null,
			granolaWebhookSecret: null,
			granolaConnectedAt: null,
			granolaLastSyncedAt: null,
			granolaLastError: null,
		},
	});
}

export type QuoConnection = {
	apiKey: string;
	webhookId: string;
	webhookSecret: string;
	phoneNumbers: unknown;
	users: unknown;
	connectedAt: Date;
};

export async function readQuoConnection(db: Db): Promise<QuoConnection | null> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			quoApiKey: true,
			quoWebhookId: true,
			quoWebhookSecret: true,
			quoPhoneNumbers: true,
			quoUsers: true,
			quoConnectedAt: true,
		},
	});
	if (
		!row?.quoApiKey ||
		!row.quoWebhookId ||
		!row.quoWebhookSecret ||
		!row.quoConnectedAt
	) {
		return null;
	}

	return {
		apiKey: row.quoApiKey,
		webhookId: row.quoWebhookId,
		webhookSecret: row.quoWebhookSecret,
		phoneNumbers: row.quoPhoneNumbers,
		users: row.quoUsers,
		connectedAt: row.quoConnectedAt,
	};
}

export async function writeQuoConnection(
	db: Db,
	connection: Omit<QuoConnection, "connectedAt">,
): Promise<void> {
	const connectedAt = new Date();
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: {
			id: SETTINGS_ID,
			quoApiKey: connection.apiKey,
			quoWebhookId: connection.webhookId,
			quoWebhookSecret: connection.webhookSecret,
			quoPhoneNumbers: connection.phoneNumbers as Prisma.InputJsonValue,
			quoUsers: connection.users as Prisma.InputJsonValue,
			quoConnectedAt: connectedAt,
		},
		update: {
			quoApiKey: connection.apiKey,
			quoWebhookId: connection.webhookId,
			quoWebhookSecret: connection.webhookSecret,
			quoPhoneNumbers: connection.phoneNumbers as Prisma.InputJsonValue,
			quoUsers: connection.users as Prisma.InputJsonValue,
			quoConnectedAt: connectedAt,
			quoLastError: null,
		},
	});
}

export async function clearQuoConnection(db: Db): Promise<void> {
	await db.appSetting.updateMany({
		where: { id: SETTINGS_ID },
		data: {
			quoApiKey: null,
			quoWebhookId: null,
			quoWebhookSecret: null,
			quoPhoneNumbers: Prisma.DbNull,
			quoUsers: Prisma.DbNull,
			quoConnectedAt: null,
			quoLastSyncedAt: null,
			quoLastError: null,
		},
	});
}

function isGranolaScope(value: unknown): value is GranolaScope {
	return value === "personal" || value === "public";
}
