import { mcpHandler } from "@better-auth/oauth-provider";
import { MCP_RESOURCE_URL, OAUTH_ISSUER } from "@crm/auth";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { All, Controller, Req, Res } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request, Response } from "express";
import type { JWTPayload } from "jose";
import { McpService } from "./mcp.service";

const verificationOptions = {
	jwksUrl: `${OAUTH_ISSUER}/jwks`,
	verifyOptions: { issuer: OAUTH_ISSUER, audience: MCP_RESOURCE_URL },
} as const;

@Controller("api/mcp")
export class McpController {
	constructor(private readonly mcp: McpService) {}

	@All()
	@AllowAnonymous()
	async handle(@Req() request: Request, @Res() response: Response) {
		let jwt: JWTPayload | undefined;
		const headers = new Headers();
		for (const [name, value] of Object.entries(request.headers)) {
			if (Array.isArray(value)) {
				for (const item of value) headers.append(name, item);
			} else if (value !== undefined) {
				headers.set(name, value);
			}
		}
		const authenticate = mcpHandler(
			verificationOptions,
			async (_request, payload) => {
				jwt = payload;
				return new globalThis.Response(null, { status: 204 });
			},
		);
		const verification = await authenticate(
			new globalThis.Request(MCP_RESOURCE_URL, {
				headers,
			}),
		);

		if (verification.status !== 204) {
			response.status(verification.status);
			verification.headers.forEach((value, name) => {
				response.setHeader(name, value);
			});
			response.send(await verification.text());
			return;
		}

		if (!jwt) throw new Error("OAuth verification returned no token payload.");
		const server = await this.mcp.createServer(jwt);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		await server.connect(transport);
		try {
			await transport.handleRequest(request, response);
		} finally {
			await server.close();
		}
	}
}
