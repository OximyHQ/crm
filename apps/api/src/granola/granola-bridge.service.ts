import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import { bridge } from "../agent/bridge";
import type { GranolaConnectInput } from "./granola.contracts";
import { GRANOLA } from "./granola-config";

const connectionReply = z.object({
	folderId: z.string().regex(/^fol_[a-zA-Z0-9]{14}$/),
	webhookEndpointId: z.string().min(1),
	webhookSecret: z.string().min(1),
});

@Injectable()
export class GranolaBridgeService {
	async connect(input: GranolaConnectInput, webhookUrl: string) {
		return connectionReply.parse(
			await this.post("/internal/crm/granola/connect", {
				...input,
				webhookUrl,
			}),
		);
	}

	async disconnect(input: {
		apiKey: string;
		webhookEndpointId: string;
	}): Promise<void> {
		await this.post("/internal/crm/granola/disconnect", input);
	}

	private async post(path: string, body: Record<string, string>) {
		const agent = bridge();
		if (!agent) {
			throw new ServiceUnavailableException(
				"The agent bridge is not configured, so Granola cannot connect.",
			);
		}

		const response = await fetch(agent.url(path), {
			method: "POST",
			headers: {
				authorization: `Bearer ${agent.secret}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(GRANOLA.bridgeTimeoutMs),
		});

		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			const message = z.object({ error: z.string() }).safeParse(payload);
			throw new ServiceUnavailableException(
				message.success
					? message.data.error
					: `The Granola connection returned ${response.status}.`,
			);
		}

		return payload;
	}
}
