import { describe, expect, it } from "bun:test";
import {
	createGranolaWebhook,
	findGranolaFolderId,
	listGranolaNoteIds,
} from "../agent/lib/granola-client";

describe("Granola connection", () => {
	it("selects the scope required by the Customer Calls folder", async () => {
		const requests: Array<{ url: string; init: RequestInit }> = [];
		const fetcher = (async (input: URL, init: RequestInit) => {
			requests.push({ url: input.toString(), init });
			if (input.pathname.endsWith("/folders")) {
				return Response.json({
					folders: [{ id: "fol_12345678901234", name: "Customer Calls" }],
					hasMore: false,
					cursor: null,
				});
			}

			const body = JSON.parse(String(init.body));
			if (body.scopes[0] !== "personal") {
				return Response.json(
					{
						code: "VALIDATION_ERROR",
						message: "Folder is not filterable under the requested scopes",
						details: [
							{
								field: "folder_ids",
								issue:
									"Filtering on folder fol_12345678901234 requires the personal scope",
							},
						],
					},
					{ status: 400 },
				);
			}

			return Response.json(
				{
					id: "whe_12345678901234",
					signing_secret: "whsec_c2lnbmluZy1zZWNyZXQ=",
				},
				{ status: 201 },
			);
		}) as typeof fetch;

		const result = await createGranolaWebhook(
			{
				apiKey: "grn_test_key",
				webhookUrl: "https://crm.example.test/api/integrations/granola/webhook",
			},
			fetcher,
		);

		expect(result).toEqual({
			folderId: "fol_12345678901234",
			scope: "personal",
			webhookEndpointId: "whe_12345678901234",
			webhookSecret: "whsec_c2lnbmluZy1zZWNyZXQ=",
		});
		expect(requests).toHaveLength(2);
	});

	it.each(["public", "workspace"] as const)(
		"retries with the %s scope when Granola requires it",
		async (requiredScope) => {
			const scopes: string[] = [];
			const fetcher = (async (_input: URL, init: RequestInit) => {
				const body = JSON.parse(String(init.body));
				const scope = String(body.scopes[0]);
				scopes.push(scope);
				if (scope !== requiredScope) {
					return Response.json(
						{
							code: "VALIDATION_ERROR",
							message: "Folder is not filterable under the requested scopes",
							details: [
								{
									field: "folder_ids",
									issue: `Filtering on folder fol_12345678901234 requires the ${requiredScope} scope`,
								},
							],
						},
						{ status: 400 },
					);
				}

				return Response.json(
					{
						id: "whe_12345678901234",
						signing_secret: "whsec_c2lnbmluZy1zZWNyZXQ=",
					},
					{ status: 201 },
				);
			}) as typeof fetch;

			const result = await createGranolaWebhook(
				{
					apiKey: "grn_test_key",
					folderId: "fol_12345678901234",
					webhookUrl:
						"https://crm.example.test/api/integrations/granola/webhook",
				},
				fetcher,
			);

			expect(result.scope).toBe(requiredScope);
			expect(scopes).toEqual(
				requiredScope === "public"
					? ["personal", "public"]
					: ["personal", "public", "workspace"],
			);
		},
	);

	it("registers a folder-scoped signed webhook", async () => {
		const requests: Array<{ url: string; init: RequestInit }> = [];
		const fetcher = (async (input: URL, init: RequestInit) => {
			requests.push({ url: input.toString(), init });
			return Response.json(
				{
					id: "whe_12345678901234",
					object: "webhook_endpoint",
					url: "https://crm.example.test/api/integrations/granola/webhook",
					events: ["note.access_granted", "note.edited", "note.generated"],
					folder_ids: ["fol_12345678901234"],
					scopes: ["personal"],
					enabled: true,
					created_at: "2026-08-13T02:00:00.000Z",
					signing_secret: "whsec_c2lnbmluZy1zZWNyZXQ=",
				},
				{ status: 201 },
			);
		}) as typeof fetch;

		const result = await createGranolaWebhook(
			{
				apiKey: "grn_test_key",
				folderId: "fol_12345678901234",
				webhookUrl: "https://crm.example.test/api/integrations/granola/webhook",
			},
			fetcher,
		);

		expect(result).toEqual({
			folderId: "fol_12345678901234",
			scope: "personal",
			webhookEndpointId: "whe_12345678901234",
			webhookSecret: "whsec_c2lnbmluZy1zZWNyZXQ=",
		});
		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).toBe(
			"https://public-api.granola.ai/v1/webhook-endpoints",
		);
		expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
			url: "https://crm.example.test/api/integrations/granola/webhook",
			scopes: ["personal"],
			events: ["note.access_granted", "note.edited", "note.generated"],
			folder_ids: ["fol_12345678901234"],
		});
	});

	it("finds the exact Customer Calls folder across pages", async () => {
		const fetcher = (async (input: URL) =>
			Response.json(
				input.searchParams.get("cursor")
					? {
							folders: [
								{
									id: "fol_12345678901234",
									name: "Customer Calls",
								},
							],
							hasMore: false,
							cursor: null,
						}
					: {
							folders: [{ id: "fol_abcdefghijklmn", name: "Sales Calls" }],
							hasMore: true,
							cursor: "next-page",
						},
			)) as typeof fetch;

		expect(
			await findGranolaFolderId("grn_test_key", "Customer Calls", fetcher),
		).toBe("fol_12345678901234");
	});

	it("paginates and deduplicates the folder backfill", async () => {
		const urls: string[] = [];
		const fetcher = (async (input: URL) => {
			urls.push(input.toString());
			return Response.json(
				urls.length === 1
					? {
							notes: [
								{ id: "not_12345678901234" },
								{ id: "not_abcdefghijklmn" },
							],
							hasMore: true,
							cursor: "next-page",
						}
					: {
							notes: [
								{ id: "not_abcdefghijklmn" },
								{ id: "not_zyxwvutsrqponm" },
							],
							hasMore: false,
							cursor: null,
						},
			);
		}) as typeof fetch;

		expect(
			await listGranolaNoteIds("grn_test_key", "fol_12345678901234", fetcher),
		).toEqual([
			"not_12345678901234",
			"not_abcdefghijklmn",
			"not_zyxwvutsrqponm",
		]);
		expect(urls[0]).toContain("folder_id=fol_12345678901234");
		expect(urls[1]).toContain("cursor=next-page");
	});
});
