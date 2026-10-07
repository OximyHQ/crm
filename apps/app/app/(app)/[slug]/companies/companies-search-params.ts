import { createListSearchParams } from "@/components/data-table/list-search-params";

export const companiesSearchParams = createListSearchParams({
	view: "companies",
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["owner", "industry", "enrichment"] as const,
});
