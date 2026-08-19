import "@crm/env/load";

import { type ClickHouseClient, createClient } from "@clickhouse/client";
import { GTM_PIPELINE, GTM_TRANSIENT_ERRORS } from "./gtm-config";

export const GTM_DATASET = "LINKEDIN_CLICKHOUSE_HOST";

let client: ClickHouseClient | null = null;

export function gtmConfigured(): boolean {
	return Boolean(process.env.LINKEDIN_CLICKHOUSE_HOST?.trim());
}

function gtmClient(): ClickHouseClient | null {
	if (!gtmConfigured()) return null;

	if (!client) {
		const host = process.env.LINKEDIN_CLICKHOUSE_HOST?.trim();
		const port = process.env.LINKEDIN_CLICKHOUSE_PORT?.trim() || "8443";
		client = createClient({
			url: `https://${host}:${port}`,
			username: process.env.LINKEDIN_CLICKHOUSE_USER?.trim() || "default",
			password: process.env.LINKEDIN_CLICKHOUSE_PASSWORD ?? "",
			database: process.env.LINKEDIN_CLICKHOUSE_DATABASE?.trim() || "default",
			request_timeout: GTM_PIPELINE.query.requestTimeoutMs,
			keep_alive: { enabled: true },
		});
	}

	return client;
}

function isTransient(message: string): boolean {
	return GTM_TRANSIENT_ERRORS.some((pattern) => message.includes(pattern));
}

export async function gtmQuery<T>(
	sql: string,
	params?: Record<string, unknown>,
): Promise<T[]> {
	const ch = gtmClient();
	if (!ch) return [];

	const { retries, retryBaseMs, maxExecutionSeconds, maxThreads } =
		GTM_PIPELINE.query;

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const result = await ch.query({
				query: sql,
				query_params: params,
				format: "JSONEachRow",
				clickhouse_settings: {
					max_execution_time: maxExecutionSeconds,
					max_threads: maxThreads,
				},
			});

			return await result.json<T>();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (isTransient(message) && attempt < retries) {
				await new Promise((resolve) =>
					setTimeout(resolve, retryBaseMs * 2 ** attempt),
				);
				continue;
			}
			throw error;
		}
	}

	return [];
}
