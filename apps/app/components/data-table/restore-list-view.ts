import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ListSearchParams } from "./list-search-params";
import { listViewCookie, pickViewParams } from "./list-view";

type SearchParams = Record<string, string | string[] | undefined>;

export async function restoreListView<
	TTab extends string,
	TFacet extends string,
>(
	list: ListSearchParams<TTab, TFacet>,
	{ path, searchParams }: { path: string; searchParams: Promise<SearchParams> },
): Promise<void> {
	const { view } = list.config;
	if (!view) return;

	const { viewKeys } = list;
	const [current, jar] = await Promise.all([searchParams, cookies()]);

	if (viewKeys.some((key) => current[key] !== undefined)) return;

	const saved = jar.get(listViewCookie(view))?.value;
	if (!saved) return;

	const restored = pickViewParams(new URLSearchParams(saved), viewKeys);
	if (restored.size === 0) return;

	for (const [key, value] of Object.entries(current)) {
		for (const item of [value ?? []].flat()) restored.append(key, item);
	}

	redirect(`${path}?${restored.toString()}`);
}
