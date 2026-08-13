export async function bufferedRequestBody(
	request: Request,
): Promise<ArrayBuffer | null> {
	if (request.method === "GET" || request.method === "HEAD") return null;
	return request.arrayBuffer();
}
