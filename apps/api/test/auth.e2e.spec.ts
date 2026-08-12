import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

const fallback = (key: string, value: string) => {
	if (!process.env[key]) {
		process.env[key] = value;
	}
};

fallback(
	"DATABASE_URL",
	"postgresql://postgres:postgres@localhost:5432/crm?schema=public",
);
fallback("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
fallback("API_URL", "http://localhost:3001");
fallback("ALLOWED_SIGN_IN", "example.com");
fallback("GOOGLE_CLIENT_ID", "test-google-client-id");
fallback("GOOGLE_CLIENT_SECRET", "test-google-client-secret");

describe("Auth (e2e)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const { AppModule } = await import("../src/app.module");

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication({ bodyParser: false });
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("rejects an unauthenticated request to a guarded route", async () => {
		await request(app.getHttpServer()).get("/auth/me").expect(401);
	});

	it("allows an unauthenticated request to an optional-auth route", async () => {
		const response = await request(app.getHttpServer())
			.get("/auth/session")
			.expect(200);

		expect(response.body).toEqual({ authenticated: false, user: null });
	});

	it("mounts the Better Auth handler", async () => {
		const response = await request(app.getHttpServer()).get("/api/auth/ok");

		expect(response.status).not.toBe(404);
	});

	it("publishes OAuth authorization server metadata", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/auth/.well-known/oauth-authorization-server")
			.expect(200);

		expect(response.body.issuer).toBe("http://localhost:3001/api/auth");
		expect(response.body.registration_endpoint).toBe(
			"http://localhost:3001/api/auth/oauth2/register",
		);
		expect(response.body.code_challenge_methods_supported).toContain("S256");
		expect(response.body.scopes_supported).toEqual(
			expect.arrayContaining(["crm:read", "crm:write", "crm:agents"]),
		);
	});

	it("publishes the RFC 8414 issuer-path metadata alias", async () => {
		const response = await request(app.getHttpServer())
			.get("/.well-known/oauth-authorization-server/api/auth")
			.expect(200);

		expect(response.body.issuer).toBe("http://localhost:3001/api/auth");
	});

	it("registers an MCP public client without a client secret", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/auth/oauth2/register")
			.set("content-type", "application/json")
			.send({
				client_name: "MCP test client",
				redirect_uris: ["http://127.0.0.1:45678/callback"],
				token_endpoint_auth_method: "none",
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				scope: "crm:read offline_access",
			})
			.expect(200);

		expect(response.body.client_id).toBeString();
		expect(response.body.client_secret).toBeUndefined();

		const { db } = await import("@crm/db");
		await db.oauthClient.delete({
			where: { clientId: response.body.client_id },
		});
	});

	it("challenges an unauthenticated MCP request with protected metadata", async () => {
		const response = await request(app.getHttpServer())
			.post("/api/mcp")
			.expect(401);

		expect(response.headers["www-authenticate"]).toBe(
			'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/api/mcp"',
		);
	});

	it("exposes only tools granted by the OAuth scope", async () => {
		const { db } = await import("@crm/db");
		const { WORKSPACE_ID } = await import("@crm/auth");
		const { McpService } = await import("../src/mcp/mcp.service");
		const userId = `mcp-user-${crypto.randomUUID()}`;
		const memberId = `mcp-member-${crypto.randomUUID()}`;
		const existingWorkspace = await db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { id: true },
		});

		if (!existingWorkspace) {
			await db.organization.create({
				data: {
					id: WORKSPACE_ID,
					name: "Test CRM",
					slug: `test-crm-${crypto.randomUUID()}`,
					createdAt: new Date(),
				},
			});
		}
		await db.user.create({
			data: {
				id: userId,
				name: "MCP Test User",
				email: `${userId}@example.com`,
				emailVerified: true,
			},
		});
		await db.member.create({
			data: {
				id: memberId,
				organizationId: WORKSPACE_ID,
				userId,
				role: "member",
				createdAt: new Date(),
			},
		});

		try {
			const mcp = app.get(McpService);
			const server = await mcp.createServer({
				sub: userId,
				scope: "crm:read",
			});
			const client = new Client({ name: "test", version: "1.0.0" });
			const [clientTransport, serverTransport] =
				InMemoryTransport.createLinkedPair();
			await server.connect(serverTransport);
			await client.connect(clientTransport);
			const tools = await client.listTools();
			const names = tools.tools.map((tool) => tool.name);

			expect(names).toContain("list_deals");
			expect(names).not.toContain("create_deal");
			expect(names).not.toContain("research_company");

			await client.close();
			await server.close();
		} finally {
			await db.member.delete({ where: { id: memberId } });
			await db.user.delete({ where: { id: userId } });
			if (!existingWorkspace) {
				await db.organization.delete({ where: { id: WORKSPACE_ID } });
			}
		}
	});

	it("lets the sign-in page read what it may offer", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/trpc/sso.signInOptions")
			.expect(200);

		const microsoftConfigured = Boolean(
			process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
		);

		expect(response.body.result.data).toEqual({
			google: true,
			microsoft: microsoftConfigured,
			providers: [],
		});
	});

	it("keeps the SSO configuration itself behind the session", async () => {
		const response = await request(app.getHttpServer()).get(
			"/api/trpc/sso.settings",
		);

		expect(response.status).toBe(401);
	});
});
