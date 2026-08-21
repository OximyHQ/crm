import "@crm/env/load";

import { type ClickHouseClient, createClient } from "@clickhouse/client";
import { LINKEDIN_DISCOVERY } from "./linkedin-config";

const TRANSIENT_ERRORS = [
	"502",
	"503",
	"ECONNRESET",
	"ETIMEDOUT",
	"aborted",
	"socket hang up",
] as const;

let client: ClickHouseClient | null = null;

export type LinkedInQueryOptions = {
	stage:
		| "company resolution"
		| "discovery query"
		| "roster scan"
		| "profile hydration";
	actionableErrors?: boolean;
	maxExecutionSeconds?: number;
	retryTimeouts?: boolean;
};

export type LinkedInQuery = <Row = unknown>(
	query: string,
	queryParams: Record<string, unknown>,
	options: LinkedInQueryOptions,
) => Promise<Row[]>;

export function linkedinClickHouseConfigured(): boolean {
	return Boolean(process.env.LINKEDIN_CLICKHOUSE_HOST?.trim());
}

export async function linkedinQuery<Row = unknown>(
	query: string,
	queryParams: Record<string, unknown>,
	options: LinkedInQueryOptions,
): Promise<Row[]> {
	const clickhouse = linkedinClient();
	if (!clickhouse) return [];
	return linkedinQueryWithClient(clickhouse, query, queryParams, options);
}

export async function linkedinQueryWithClient<Row = unknown>(
	clickhouse: ClickHouseClient,
	query: string,
	queryParams: Record<string, unknown>,
	options: LinkedInQueryOptions,
): Promise<Row[]> {
	const maxExecutionSeconds =
		options.maxExecutionSeconds ?? LINKEDIN_DISCOVERY.query.maxExecutionSeconds;

	for (
		let attempt = 0;
		attempt <= LINKEDIN_DISCOVERY.query.retries;
		attempt++
	) {
		const startedAt = Date.now();
		try {
			const result = await clickhouse.query({
				query,
				query_params: queryParams,
				format: "JSONEachRow",
				clickhouse_settings: {
					max_execution_time: maxExecutionSeconds,
					max_threads: LINKEDIN_DISCOVERY.query.maxThreads,
					use_query_cache: 1,
					query_cache_ttl: LINKEDIN_DISCOVERY.query.cacheSeconds,
				},
			});

			const rows = await result.json<Row>();
			console.info("[agent] LinkedIn query completed", {
				stage: options.stage,
				attempt: attempt + 1,
				durationMs: Date.now() - startedAt,
				rowCount: rows.length,
				maxExecutionSeconds,
			});
			return rows;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const timeout = message.includes("Timeout exceeded");
			const code = safeErrorCode(error);
			const transient =
				TRANSIENT_ERRORS.some((value) => message.includes(value)) ||
				((options.retryTimeouts ?? true) && timeout);
			if (!transient || attempt === LINKEDIN_DISCOVERY.query.retries) {
				console.error("[agent] LinkedIn query failed", {
					stage: options.stage,
					attempt: attempt + 1,
					durationMs: Date.now() - startedAt,
					maxExecutionSeconds,
					kind: timeout ? "timeout" : transient ? "transport" : "query",
					code,
				});
				if (!options.actionableErrors) throw error;
				throw actionableQueryError(
					options.stage,
					timeout,
					transient,
					maxExecutionSeconds,
					code,
					error,
				);
			}

			console.warn("[agent] LinkedIn query retry", {
				stage: options.stage,
				attempt: attempt + 1,
				durationMs: Date.now() - startedAt,
				maxExecutionSeconds,
				kind: timeout ? "timeout" : "transport",
			});

			await new Promise((resolve) =>
				setTimeout(resolve, LINKEDIN_DISCOVERY.query.retryDelayMs),
			);
		}
	}

	return [];
}

function actionableQueryError(
	stage: LinkedInQueryOptions["stage"],
	timeout: boolean,
	transient: boolean,
	maxExecutionSeconds: number,
	code: string | null,
	cause: unknown,
): Error {
	let message = `LinkedIn ${stage} query failed.`;
	if (timeout) {
		message = `LinkedIn ${stage} timed out after ${maxExecutionSeconds} seconds.`;
	} else if (transient) {
		message = `LinkedIn ${stage} failed because ClickHouse was unavailable.`;
	} else if (code) {
		message = `LinkedIn ${stage} failed with ClickHouse code ${code}.`;
	}
	return new Error(message, { cause });
}

function safeErrorCode(error: unknown): string | null {
	if (!error || typeof error !== "object" || !("code" in error)) return null;
	const code = String(error.code);
	return /^[A-Z0-9_]{1,32}$/.test(code) ? code : null;
}

function linkedinClient(): ClickHouseClient | null {
	const host = process.env.LINKEDIN_CLICKHOUSE_HOST?.trim();
	if (!host) return null;
	if (client) return client;

	const port = process.env.LINKEDIN_CLICKHOUSE_PORT?.trim() || "8443";
	client = createClient({
		url: `https://${host}:${port}`,
		username: process.env.LINKEDIN_CLICKHOUSE_USER?.trim() || "default",
		password: process.env.LINKEDIN_CLICKHOUSE_PASSWORD ?? "",
		database: process.env.LINKEDIN_CLICKHOUSE_DATABASE?.trim() || "oximy",
		request_timeout: LINKEDIN_DISCOVERY.query.timeoutMs,
		keep_alive: { enabled: true },
	});

	return client;
}
