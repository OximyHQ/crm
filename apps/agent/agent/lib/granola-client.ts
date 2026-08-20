import type { GranolaScope } from "@crm/db/settings";
import { z } from "zod";
import { GRANOLA } from "./granola-config";
import { type GranolaNote, granolaNote } from "./granola-note";

const webhookEndpoint = z.object({
	id: z.string().min(1),
	signing_secret: z.string().min(1),
});

const granolaFailure = z.object({
	code: z.string().optional(),
	message: z.string().optional(),
	details: z
		.array(
			z.object({
				field: z.string(),
				issue: z.string(),
			}),
		)
		.optional(),
});

const noteList = z.object({
	notes: z.array(z.object({ id: z.string().min(1) })),
	hasMore: z.boolean(),
	cursor: z.string().nullable(),
});

const folderList = z.object({
	folders: z.array(
		z.object({
			id: z.string().regex(/^fol_[a-zA-Z0-9]{14}$/),
			name: z.string(),
		}),
	),
	hasMore: z.boolean(),
	cursor: z.string().nullable(),
});

export async function createGranolaWebhook(
	input: {
		apiKey: string;
		folderId?: string;
		webhookUrl: string;
	},
	fetcher: typeof fetch = fetch,
): Promise<{
	folderId: string;
	scope: GranolaScope;
	webhookEndpointId: string;
	webhookSecret: string;
}> {
	const folderId =
		input.folderId ??
		(await findGranolaFolderId(input.apiKey, "Customer Calls", fetcher));

	for (const scope of GRANOLA.webhook.scopeCandidates) {
		try {
			const data = await request(
				"webhook-endpoints",
				input.apiKey,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						url: input.webhookUrl,
						scopes: [scope],
						events: ["note.access_granted", "note.edited", "note.generated"],
						folder_ids: [folderId],
					}),
				},
				fetcher,
			);
			const parsed = webhookEndpoint.parse(data);

			return {
				folderId,
				scope,
				webhookEndpointId: parsed.id,
				webhookSecret: parsed.signing_secret,
			};
		} catch (error) {
			if (!isScopeValidationError(error)) throw error;
		}
	}

	throw new Error(
		"Granola cannot connect the Customer Calls folder with this API key. Check the key access in Granola Settings.",
	);
}

export async function findGranolaFolderId(
	apiKey: string,
	name: string,
	fetcher: typeof fetch = fetch,
): Promise<string> {
	const matches: Array<{ id: string; name: string }> = [];
	let cursor: string | null = null;

	do {
		const url = new URL("folders", GRANOLA.apiBaseUrl);
		url.searchParams.set("page_size", String(GRANOLA.pageSize));
		if (cursor) url.searchParams.set("cursor", cursor);
		const page = folderList.parse(
			await requestUrl(url, apiKey, { method: "GET" }, fetcher),
		);
		matches.push(
			...page.folders.filter(
				(folder) => folder.name.trim().toLowerCase() === name.toLowerCase(),
			),
		);
		cursor = page.hasMore ? page.cursor : null;
		if (page.hasMore && !cursor) {
			throw new Error("Granola reported another folder page without a cursor.");
		}
	} while (cursor);

	if (matches.length === 1 && matches[0]) return matches[0].id;
	if (matches.length === 0) {
		throw new Error(
			`Granola has no accessible folder named ${name}. Check the API key access scope.`,
		);
	}
	throw new Error(
		`Granola has ${matches.length} accessible folders named ${name}. Rename duplicates before connecting.`,
	);
}

export async function deleteGranolaWebhook(
	apiKey: string,
	webhookEndpointId: string,
	fetcher: typeof fetch = fetch,
): Promise<void> {
	await request(
		`webhook-endpoints/${encodeURIComponent(webhookEndpointId)}`,
		apiKey,
		{ method: "DELETE" },
		fetcher,
	);
}

export async function getGranolaNote(
	apiKey: string,
	noteId: string,
	fetcher: typeof fetch = fetch,
): Promise<GranolaNote> {
	return granolaNote.parse(
		await request(
			`notes/${encodeURIComponent(noteId)}`,
			apiKey,
			{ method: "GET" },
			fetcher,
		),
	);
}

export async function listGranolaNoteIds(
	apiKey: string,
	folderId: string,
	fetcher: typeof fetch = fetch,
): Promise<string[]> {
	const ids: string[] = [];
	let cursor: string | null = null;

	do {
		const url = new URL("notes", GRANOLA.apiBaseUrl);
		url.searchParams.set("folder_id", folderId);
		url.searchParams.set("page_size", String(GRANOLA.pageSize));
		if (cursor) url.searchParams.set("cursor", cursor);

		const page = noteList.parse(
			await requestUrl(url, apiKey, { method: "GET" }, fetcher),
		);
		ids.push(...page.notes.map((note) => note.id));
		cursor = page.hasMore ? page.cursor : null;
		if (page.hasMore && !cursor) {
			throw new Error("Granola reported another page without a cursor.");
		}
	} while (cursor);

	return [...new Set(ids)];
}

async function request(
	path: string,
	apiKey: string,
	init: RequestInit,
	fetcher: typeof fetch,
): Promise<unknown> {
	return requestUrl(new URL(path, GRANOLA.apiBaseUrl), apiKey, init, fetcher);
}

async function requestUrl(
	url: URL,
	apiKey: string,
	init: RequestInit,
	fetcher: typeof fetch,
): Promise<unknown> {
	const response = await fetcher(url, {
		...init,
		headers: {
			authorization: `Bearer ${apiKey}`,
			...init.headers,
		},
		signal: init.signal ?? AbortSignal.timeout(GRANOLA.requestTimeoutMs),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		const failure = parseFailure(detail);
		throw new GranolaRequestError(
			response.status,
			failure,
			granolaRequestMessage(response.status, failure),
		);
	}

	return response.json();
}

class GranolaRequestError extends Error {
	constructor(
		readonly status: number,
		readonly failure: z.infer<typeof granolaFailure> | null,
		message: string,
	) {
		super(message);
	}
}

function parseFailure(detail: string): z.infer<typeof granolaFailure> | null {
	if (!detail) return null;
	let value: unknown;
	try {
		value = JSON.parse(detail);
	} catch {
		return null;
	}
	const parsed = granolaFailure.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function granolaRequestMessage(
	status: number,
	failure: z.infer<typeof granolaFailure> | null,
): string {
	if (status === 401) {
		return "Granola rejected this API key. Create a new key in Granola Settings and try again.";
	}
	return failure?.message
		? `Granola returned ${status}: ${failure.message}`
		: `Granola returned ${status}.`;
}

function isScopeValidationError(error: unknown): boolean {
	if (!(error instanceof GranolaRequestError) || error.status !== 400) {
		return false;
	}
	const failure = error.failure;
	if (failure?.code !== "VALIDATION_ERROR") return false;
	return [
		failure.message,
		...(failure.details?.map((detail) => detail.issue) ?? []),
	]
		.filter((value): value is string => Boolean(value))
		.some((value) => value.toLowerCase().includes("scope"));
}
