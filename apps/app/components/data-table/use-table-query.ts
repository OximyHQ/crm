"use client";

import type { TableQueryState } from "@crm/ui/lib/table-query";
import { useQueryStates } from "nuqs";
import type {
	ListInput,
	ListSearchParams,
	ListSearchValues,
} from "./list-search-params";
import { rememberListView } from "./list-view";

export type TableQuery<TKey extends string> = {
	query: TableQueryState;
	input: ListInput<TKey>;
};

export function useTableQuery<TTab extends string, TFacet extends string>(
	searchParams: ListSearchParams<TTab, TFacet>,
): TableQuery<TTab | TFacet> {
	const { parsers, config, toInput, viewKeys } = searchParams;
	const { defaultDir, pageSize, tabId, facetIds, facetDefaults, view } = config;

	const [state, setQueryState] = useQueryStates(parsers);
	const onViewChange = view
		? (params: URLSearchParams) => rememberListView(view, viewKeys, params)
		: undefined;
	const setState: typeof setQueryState = (update, options) => {
		const result = setQueryState(update, options);
		if (onViewChange) void result.then(onViewChange);
		return result;
	};
	const values = state as ListSearchValues<TTab | TFacet>;

	const page = values.page > 0 ? values.page : 1;
	const tab = tabId ? values[tabId] : "all";

	const filters: Record<string, string> = {};
	if (tabId) filters[tabId] = tab;
	for (const id of facetIds ?? []) {
		filters[id] = values[id] ?? facetDefaults?.[id] ?? "all";
	}

	const query: TableQueryState = {
		sort: values.sort,
		dir: values.dir,
		page,
		pageSize,
		tab,
		tabId,
		filters,
		onViewChange,
		toggleSort: (id) =>
			setState((prev) =>
				prev.sort === id
					? { ...prev, dir: prev.dir === "asc" ? "desc" : "asc", page: 1 }
					: { ...prev, sort: id, dir: defaultDir, page: 1 },
			),
		setSort: (id) => setState((prev) => ({ ...prev, sort: id, page: 1 })),
		setDir: (dir) => setState((prev) => ({ ...prev, dir, page: 1 })),
		setPage: (next) => setState((prev) => ({ ...prev, page: next })),
		setTab: (value) => {
			if (!tabId) return;
			setState((prev) => ({ ...prev, [tabId]: value, page: 1 }));
		},
		setFilter: (id, value) =>
			setState((prev) => ({ ...prev, [id]: value, page: 1 })),
	};

	return { query, input: toInput(values) };
}
