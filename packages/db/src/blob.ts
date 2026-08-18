import { createHash } from "node:crypto";
import { BLOB_MIRROR } from "./blob-config";
import { isMirrored } from "./images";
import { safeFetch } from "./safe-fetch";

export { isMirrored, isOptimizable } from "./images";

const ALLOWED: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"image/svg+xml": "svg",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
};

const AUDIO_ALLOWED: Record<string, string> = {
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"audio/x-m4a": "m4a",
	"audio/wav": "wav",
	"audio/x-wav": "wav",
	"audio/ogg": "ogg",
	"audio/webm": "webm",
};

export function blobEnabled(): boolean {
	return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function mirror(
	sourceUrl: string,
	prefix: string,
): Promise<string | null> {
	return mirrorFile(sourceUrl, prefix, ALLOWED, BLOB_MIRROR.imageMaxBytes);
}

export async function mirrorRecording(
	sourceUrl: string,
	prefix: string,
): Promise<string | null> {
	return mirrorFile(
		sourceUrl,
		prefix,
		AUDIO_ALLOWED,
		BLOB_MIRROR.audioMaxBytes,
	);
}

async function mirrorFile(
	sourceUrl: string,
	prefix: string,
	allowed: Record<string, string>,
	maxBytes: number,
): Promise<string | null> {
	if (!blobEnabled()) return null;
	if (isMirrored(sourceUrl)) return sourceUrl;

	try {
		const result = await safeFetch(sourceUrl, {
			timeoutMs: BLOB_MIRROR.requestTimeoutMs,
		});
		if (!result?.response.ok) return null;

		const { response } = result;
		const type = response.headers.get("content-type")?.split(";")[0]?.trim();
		const extension = type ? allowed[type.toLowerCase()] : undefined;
		if (!type || !extension) return null;

		const bytes = await readCapped(response, maxBytes);
		if (!bytes) return null;

		const digest = createHash("sha256")
			.update(bytes)
			.digest("hex")
			.slice(0, 12);

		const { put } = await import("@vercel/blob");

		const blob = await put(`${prefix}-${digest}.${extension}`, bytes, {
			access: "public",
			contentType: type,
			addRandomSuffix: false,
			allowOverwrite: true,
		});

		return blob.url;
	} catch {
		return null;
	}
}

async function readCapped(
	response: Response,
	maxBytes: number,
): Promise<Buffer | null> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel();
		return null;
	}

	if (!response.body) return null;

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;

	try {
		while (size <= maxBytes) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			chunks.push(value);
		}
	} catch {
		return null;
	} finally {
		await reader.cancel().catch(() => {});
	}

	if (size === 0 || size > maxBytes) return null;
	return Buffer.concat(chunks);
}
