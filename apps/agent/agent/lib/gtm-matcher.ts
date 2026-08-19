import {
	GTM_DEMOTE_KEYWORDS,
	GTM_EXCLUDE_KEYWORDS,
	GTM_FALLBACK_MAX_RANK,
	GTM_SENIORITY_BANDS,
	GTM_UNMATCHED_RANK,
	type GtmKeyword,
	type GtmKeywordRule,
} from "./gtm-config";

export type TitleMatch = {
	tier: number;
	orgFunction: string;
	seniorityRank: number;
};

type CompiledKeyword = {
	keyword: string;
	unless: readonly string[];
	pattern: RegExp;
};

function asRule(keyword: GtmKeyword): GtmKeywordRule {
	return typeof keyword === "string" ? { keyword } : keyword;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compile(keyword: GtmKeyword): CompiledKeyword {
	const rule = asRule(keyword);
	const lowered = rule.keyword.toLowerCase();
	return {
		keyword: lowered,
		unless: (rule.unless ?? []).map((value) => value.toLowerCase()),
		pattern: new RegExp(`(?<![a-z0-9])${escapeRegExp(lowered)}(?![a-z0-9])`),
	};
}

function matches(lowered: string, compiled: CompiledKeyword): boolean {
	if (!compiled.pattern.test(lowered)) return false;
	return !compiled.unless.some((blocker) => lowered.includes(blocker));
}

const BANDS: readonly {
	rank: number;
	keywords: readonly CompiledKeyword[];
}[] = GTM_SENIORITY_BANDS.map((band) => ({
	rank: band.rank,
	keywords: band.keywords.map(compile),
}));

const EXCLUDE_KEYWORDS: readonly CompiledKeyword[] =
	GTM_EXCLUDE_KEYWORDS.map(compile);

const DEMOTE_KEYWORDS: readonly CompiledKeyword[] =
	GTM_DEMOTE_KEYWORDS.map(compile);

export function seniorityRankOf(title: string): number {
	const lowered = title.toLowerCase();
	for (const band of BANDS) {
		if (band.keywords.some((keyword) => matches(lowered, keyword))) {
			return band.rank;
		}
	}
	return GTM_UNMATCHED_RANK;
}

export function matchTitle(title: string): TitleMatch | null {
	const lowered = title.toLowerCase();
	if (EXCLUDE_KEYWORDS.some((keyword) => matches(lowered, keyword))) {
		return null;
	}
	if (DEMOTE_KEYWORDS.some((keyword) => matches(lowered, keyword))) {
		return null;
	}

	const rank = seniorityRankOf(title);
	if (rank > GTM_FALLBACK_MAX_RANK) return null;

	return {
		tier: rank <= 2 ? 1 : 2,
		orgFunction: "Other",
		seniorityRank: rank,
	};
}

function escapeChLiteral(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildCoarseRankSql(titleColumnExpr: string): string {
	const column = titleColumnExpr.trim();
	if (!column) {
		throw new Error("buildCoarseRankSql needs a title column expression");
	}

	const entries = BANDS.flatMap((band) =>
		band.keywords.map((keyword) => ({ ...keyword, rank: band.rank })),
	).sort((a, b) => b.keyword.length - a.keyword.length);

	const branches = entries.map((entry) => {
		const literal = escapeChLiteral(entry.keyword);
		const condition = /^[a-z0-9]+$/.test(entry.keyword)
			? `match(lowerUTF8(${column}), '(^|[^a-z0-9])${literal}($|[^a-z0-9])')`
			: `position(lowerUTF8(${column}), '${literal}') > 0`;
		return `${condition}, ${entry.rank}`;
	});

	return `multiIf(${branches.join(", ")}, ${GTM_UNMATCHED_RANK})`;
}
