import { API_URL } from "@/lib/env";

export async function GET() {
	const upstream = await fetch(
		`${API_URL}/.well-known/oauth-authorization-server/api/auth`,
	);
	const headers = new Headers(upstream.headers);
	headers.set("access-control-allow-origin", "*");
	headers.set("cache-control", "public, max-age=300");
	return new Response(upstream.body, { status: upstream.status, headers });
}
