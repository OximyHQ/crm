import type { Readable } from "node:stream";

type RequestBodySource = Readable & { body?: unknown };

export async function readMcpRequestBody(
	request: RequestBodySource,
): Promise<unknown> {
	if (request.body !== undefined) return request.body;

	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
