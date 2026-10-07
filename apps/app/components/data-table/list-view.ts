const DAY_MS = 86_400_000;

export const LIST_VIEW = {
	cookiePrefix: "crm-view-",
	maxAgeMs: 365 * DAY_MS,
	columnsKey: "hide",
} as const;

export function listViewCookie(view: string): string {
	return `${LIST_VIEW.cookiePrefix}${view}`;
}

export function pickViewParams(
	params: URLSearchParams,
	keys: readonly string[],
): URLSearchParams {
	const kept = new URLSearchParams();
	for (const [key, value] of params) {
		if (keys.includes(key)) kept.append(key, value);
	}
	return kept;
}

export function rememberListView(
	view: string,
	keys: readonly string[],
	params: URLSearchParams,
): void {
	void cookieStore.set({
		name: listViewCookie(view),
		value: pickViewParams(params, keys).toString(),
		path: "/",
		expires: Date.now() + LIST_VIEW.maxAgeMs,
		sameSite: "lax",
	});
}
