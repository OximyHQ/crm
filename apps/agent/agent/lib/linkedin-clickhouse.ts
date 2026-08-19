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
	"Timeout exceeded",
] as const;

let client: ClickHouseClient | null = null;

export function linkedinClickHouseConfigured(): boolean {
	return Boolean(process.env.LINKEDIN_CLICKHOUSE_HOST?.trim());
}

export async function linkedinQuery<Row = unknown>(
	query: string,
	queryParams: Record<string, unknown>,
	options: { maxExecutionSeconds?: number } = {},
): Promise<Row[]> {
	const clickhouse = linkedinClient();
	if (!clickhouse) return [];

	for (
		let attempt = 0;
		attempt <= LINKEDIN_DISCOVERY.query.retries;
		attempt++
	) {
		try {
			const result = await clickhouse.query({
				query,
				query_params: queryParams,
				format: "JSONEachRow",
				clickhouse_settings: {
					max_execution_time:
						options.maxExecutionSeconds ??
						LINKEDIN_DISCOVERY.query.maxExecutionSeconds,
					max_threads: LINKEDIN_DISCOVERY.query.maxThreads,
					use_query_cache: 1,
					query_cache_ttl: LINKEDIN_DISCOVERY.query.cacheSeconds,
				},
			});

			return result.json<Row>();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const transient = TRANSIENT_ERRORS.some((value) =>
				message.includes(value),
			);
			if (!transient || attempt === LINKEDIN_DISCOVERY.query.retries) {
				throw error;
			}

			await new Promise((resolve) =>
				setTimeout(resolve, LINKEDIN_DISCOVERY.query.retryDelayMs),
			);
		}
	}

	return [];
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
