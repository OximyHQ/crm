import { describe, expect, it } from "bun:test";
import {
	createGranolaWebhook,
	findGranolaFolderId,
	listGranolaNoteIds,
} from "../agent/lib/granola-client";

describe("Granola connection", () => {
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
				scope: "personal",
				webhookUrl: "https://crm.example.test/api/integrations/granola/webhook",
			},
			fetcher,
		);

		expect(result).toEqual({
			folderId: "fol_12345678901234",
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
