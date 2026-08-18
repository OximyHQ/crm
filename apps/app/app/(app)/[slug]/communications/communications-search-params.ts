import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const COMMUNICATION_FILTERS = [
	"all",
	"calls",
	"messages",
	"review",
] as const;

export const DEFAULT_COMMUNICATIONS_QUERY = {
	q: "",
	filter: "all" as const,
	page: 1,
	pageSize: 50,
};

export const communicationsSearchParams = {
	q: parseAsString.withDefault(DEFAULT_COMMUNICATIONS_QUERY.q),
	filter: parseAsStringLiteral(COMMUNICATION_FILTERS).withDefault(
		DEFAULT_COMMUNICATIONS_QUERY.filter,
	),
	page: parseAsInteger.withDefault(DEFAULT_COMMUNICATIONS_QUERY.page),
};
