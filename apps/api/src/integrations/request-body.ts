import type { IncomingMessage } from "node:http";

type RawBodyRequest = IncomingMessage & { rawBody?: Buffer };

export function parseJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}

export async function readBody(
	request: RawBodyRequest,
	limit: number,
): Promise<string | null> {
	if (request.rawBody) {
		return request.rawBody.length <= limit
			? request.rawBody.toString("utf8")
			: null;
	}
	if (request.readableEnded) return null;

	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		let settled = false;

		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		request.on("data", (chunk: Buffer | string) => {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += buffer.length;
			if (size > limit) {
				request.destroy();
				finish(null);
				return;
			}
			chunks.push(buffer);
		});
		request.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
		request.on("error", () => finish(null));
	});
}
