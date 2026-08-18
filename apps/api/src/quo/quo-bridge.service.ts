import { schemas } from "@crm/validation";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import { bridge } from "../agent/bridge";
import type { QuoConnectInput } from "./quo.contracts";
import { QUO } from "./quo-config";

@Injectable()
export class QuoBridgeService {
	async connect(input: QuoConnectInput, webhookUrl: string) {
		return schemas.quo.connectionReply.parse(
			await this.post("/internal/crm/quo/connect", { ...input, webhookUrl }),
		);
	}

	async disconnect(input: {
		apiKey: string;
		webhookId: string;
	}): Promise<void> {
		await this.post("/internal/crm/quo/disconnect", input);
	}

	private async post(path: string, body: Record<string, string>) {
		const agent = bridge();
		if (!agent) {
			throw new ServiceUnavailableException(
				"The agent bridge is not configured, so Quo cannot connect.",
			);
		}

		const response = await fetch(agent.url(path), {
			method: "POST",
			headers: {
				authorization: `Bearer ${agent.secret}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(QUO.bridgeTimeoutMs),
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			const message = z.object({ error: z.string() }).safeParse(payload);
			throw new ServiceUnavailableException(
				message.success
					? message.data.error
					: `The Quo connection returned ${response.status}.`,
			);
		}
		return payload;
	}
}
