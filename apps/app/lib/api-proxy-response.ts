import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { z } from "zod";

const oauthAuthorizeRedirect = z.object({
	redirect: z.literal(true),
	url: z.string().min(1),
});

export async function browserNavigationResponse(
	pathname: string,
	upstream: Response,
	headers: Headers,
): Promise<Response | null> {
	if (pathname !== "/api/auth/oauth2/authorize" || !upstream.ok) return null;

	const redirect = oauthAuthorizeRedirect.parse(await upstream.clone().json());
	const responseHeaders = new Headers(headers);
	responseHeaders.set("location", redirect.url);
	responseHeaders.delete("content-encoding");
	responseHeaders.delete("content-length");
	responseHeaders.delete("content-type");

	return new Response(null, { status: 302, headers: responseHeaders });
}

export async function bufferedProxyResponse(
	upstream: Response,
	headers: Headers,
	method: string,
): Promise<Response> {
	const responseHeaders = new Headers(headers);
	responseHeaders.delete("content-encoding");
	responseHeaders.delete("content-length");
	const init: ResponseInit = {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders,
	};
	if (!responseCanHaveBody(method, upstream.status)) {
		return new Response(null, init);
	}

	const raw = Buffer.from(await upstream.arrayBuffer());
	const body = decode(raw, upstream.headers.get("content-encoding"));
	return new Response(new Uint8Array(body), init);
}

export function responseCanHaveBody(method: string, status: number): boolean {
	return method !== "HEAD" && ![204, 205, 304].includes(status);
}

function decode(buf: Buffer, encoding: string | null): Buffer {
	const enc = (encoding ?? "").toLowerCase();
	try {
		if (enc.includes("br")) return brotliDecompressSync(buf);
		if (enc.includes("gzip")) return gunzipSync(buf);
		if (enc.includes("deflate")) return inflateSync(buf);
	} catch {}
	return buf;
}
