import { schemas } from "@crm/validation";
import { z } from "zod";
import { QUO } from "./quo-config";

const quoWebhook = z.object({
	id: z.string(),
	label: z.string(),
	url: z.url(),
	status: z.string(),
});

const webhookCredential = z.object({
	id: z.string(),
	key: z.string().startsWith("whsec_"),
});

const page = <Schema extends z.ZodType>(schema: Schema) =>
	z.object({
		data: z.array(schema),
		nextCursor: z.string().nullable().optional(),
	});

const contactPage = z.object({
	data: z.array(schemas.quo.contactSnapshot),
	nextPageToken: z.string().nullable(),
});

const contactReply = z.object({ data: schemas.quo.contactSnapshot });

export async function createQuoConnection(
	input: {
		apiKey: string;
		webhookUrl: string;
	},
	fetcher: typeof fetch = fetch,
) {
	const [users, phoneNumbers, webhooks] = await Promise.all([
		quoFetch("/users", input.apiKey, {}, fetcher).then(
			(value) => page(schemas.quo.userSnapshot).parse(value).data,
		),
		quoV1Fetch("/phone-numbers", input.apiKey, {}, fetcher).then(
			(value) => page(schemas.quo.phoneNumberSnapshot).parse(value).data,
		),
		quoFetch("/webhooks", input.apiKey, {}, fetcher).then(
			(value) => page(quoWebhook).parse(value).data,
		),
	]);

	const existing = webhooks.filter(
		(webhook) =>
			webhook.label === QUO.webhook.label || webhook.url === input.webhookUrl,
	);
	if (existing.length > 1) {
		throw new Error(
			"Quo has several Oximy CRM webhooks. Remove the duplicates before reconnecting.",
		);
	}
	if (existing[0]) {
		await deleteQuoWebhook(input.apiKey, existing[0].id, fetcher);
	}

	const credential = webhookCredential.parse(
		await quoFetch(
			"/webhooks",
			input.apiKey,
			{
				method: "POST",
				body: JSON.stringify({
					label: QUO.webhook.label,
					url: input.webhookUrl,
					status: "enabled",
					resourceIds: ["*"],
					events: QUO.webhook.events,
				}),
			},
			fetcher,
		),
	);

	return {
		webhookId: credential.id,
		webhookSecret: credential.key,
		phoneNumbers,
		users,
	};
}

export async function deleteQuoWebhook(
	apiKey: string,
	webhookId: string,
	fetcher: typeof fetch = fetch,
): Promise<void> {
	await quoFetch(
		`/webhooks/${encodeURIComponent(webhookId)}`,
		apiKey,
		{
			method: "DELETE",
		},
		fetcher,
	);
}

export async function listQuoContacts(
	apiKey: string,
	options: { externalIds?: string[] } = {},
	fetcher: typeof fetch = fetch,
) {
	const contacts: z.infer<typeof schemas.quo.contactSnapshot>[] = [];
	let pageToken: string | null = null;
	do {
		const search = new URLSearchParams({
			maxResults: String(QUO.contacts.pageSize),
		});
		for (const externalId of options.externalIds ?? []) {
			search.append("externalIds", externalId);
		}
		if (pageToken) search.set("pageToken", pageToken);
		const response = contactPage.parse(
			await quoV1Fetch(`/contacts?${search}`, apiKey, {}, fetcher),
		);
		contacts.push(...response.data);
		pageToken = response.nextPageToken;
	} while (pageToken);
	return contacts;
}

export async function getQuoContact(
	apiKey: string,
	id: string,
	fetcher: typeof fetch = fetch,
) {
	return contactReply.parse(
		await quoV1Fetch(
			`/contacts/${encodeURIComponent(id)}`,
			apiKey,
			{},
			fetcher,
		),
	).data;
}

export async function createQuoContact(
	apiKey: string,
	payload: unknown,
	fetcher: typeof fetch = fetch,
) {
	return contactReply.parse(
		await quoV1Fetch(
			"/contacts",
			apiKey,
			{ method: "POST", body: JSON.stringify(payload) },
			fetcher,
		),
	).data;
}

export async function updateQuoContact(
	apiKey: string,
	id: string,
	payload: unknown,
	fetcher: typeof fetch = fetch,
) {
	return contactReply.parse(
		await quoV1Fetch(
			`/contacts/${encodeURIComponent(id)}`,
			apiKey,
			{ method: "PATCH", body: JSON.stringify(payload) },
			fetcher,
		),
	).data;
}

async function quoFetch(
	path: string,
	apiKey: string,
	init: RequestInit = {},
	fetcher: typeof fetch = fetch,
): Promise<unknown> {
	return request(`${QUO.apiBase}${path}`, apiKey, init, true, fetcher);
}

async function quoV1Fetch(
	path: string,
	apiKey: string,
	init: RequestInit = {},
	fetcher: typeof fetch = fetch,
): Promise<unknown> {
	return request(`${QUO.v1ApiBase}${path}`, apiKey, init, false, fetcher);
}

async function request(
	url: string,
	apiKey: string,
	init: RequestInit,
	versioned: boolean,
	fetcher: typeof fetch,
): Promise<unknown> {
	const response = await fetcher(url, {
		...init,
		headers: {
			authorization: apiKey,
			"content-type": "application/json",
			...(versioned ? { "Quo-Api-Version": QUO.apiVersion } : {}),
			...init.headers,
		},
		signal: AbortSignal.timeout(QUO.requestTimeoutMs),
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`Quo returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : "."}`,
		);
	}
	if (response.status === 204) return null;
	return response.json() as Promise<unknown>;
}
