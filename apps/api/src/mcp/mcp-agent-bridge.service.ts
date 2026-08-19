import { schemas } from "@crm/validation";
import { Injectable } from "@nestjs/common";
import type { z } from "zod";
import { bridge } from "../agent/bridge";
import { MCP_AGENT_BRIDGE } from "./mcp-agent-bridge.config";

@Injectable()
export class McpAgentBridgeService {
	searchLinkedinPeople(
		input: z.infer<typeof schemas.oximy.linkedinPeopleSearchInput>,
	) {
		return this.post(
			"/internal/crm/linkedin/search-people",
			input,
			schemas.oximy.linkedinPeopleSearchResult,
		);
	}

	getLinkedinPerson(input: z.infer<typeof schemas.oximy.linkedinPersonInput>) {
		return this.post(
			"/internal/crm/linkedin/person",
			input,
			schemas.oximy.linkedinPersonResult,
		);
	}

	resolveLinkedinCompany(
		input: z.infer<typeof schemas.oximy.linkedinCompanyResolutionInput>,
	) {
		return this.post(
			"/internal/crm/linkedin/resolve-company",
			input,
			schemas.oximy.linkedinCompanyResolutionResult,
		);
	}

	listLinkedinCompanyEmployees(
		input: z.infer<typeof schemas.oximy.linkedinCompanyEmployeesInput>,
	) {
		return this.post(
			"/internal/crm/linkedin/company-employees",
			input,
			schemas.oximy.linkedinCompanyEmployeesResult,
		);
	}

	private async post<Schema extends z.ZodType>(
		path: string,
		body: unknown,
		schema: Schema,
	): Promise<z.infer<Schema>> {
		const agent = bridge();
		if (!agent) {
			return schema.parse({
				ok: false,
				configured: false,
				reason: "The CRM agent bridge is not configured.",
			});
		}

		try {
			const response = await fetch(agent.url(path), {
				method: "POST",
				headers: {
					authorization: `Bearer ${agent.secret}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(MCP_AGENT_BRIDGE.timeoutMs),
			});
			if (!response.ok) {
				return schema.parse({
					ok: false,
					configured: true,
					reason: `The CRM agent returned HTTP ${response.status}.`,
				});
			}

			return schema.parse(await response.json());
		} catch (error) {
			return schema.parse({
				ok: false,
				configured: true,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
