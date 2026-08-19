import {
	GTM_DEMOTE_KEYWORDS,
	GTM_EXCLUDE_KEYWORDS,
	GTM_FUNCTION,
	GTM_FUNCTION_RULES,
	GTM_ICP_TIERS,
	GTM_SENIORITY_RULES,
	GTM_UNMATCHED_TIER,
	GTM_UNRANKED_SENIORITY,
	type GtmFunction,
	type GtmKeyword,
	type GtmKeywordRule,
} from "./gtm-config";

export type TitleMatch = {
	tier: number;
	orgFunction: GtmFunction;
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

const TIER_KEYWORDS: readonly (CompiledKeyword & { tier: number })[] =
	GTM_ICP_TIERS.flatMap((row) =>
		row.keywords.map((keyword) => ({ ...compile(keyword), tier: row.tier })),
	).sort((a, b) => b.keyword.length - a.keyword.length);

const FUNCTION_RULES: readonly {
	id: GtmFunction;
	keywords: readonly CompiledKeyword[];
}[] = GTM_FUNCTION_RULES.map((rule) => ({
	id: rule.id,
	keywords: rule.keywords.map(compile),
}));

const SENIORITY_RULES: readonly {
	rank: number;
	keywords: readonly CompiledKeyword[];
}[] = GTM_SENIORITY_RULES.map((rule) => ({
	rank: rule.rank,
	keywords: rule.keywords.map(compile),
}));

const EXCLUDE_KEYWORDS: readonly CompiledKeyword[] =
	GTM_EXCLUDE_KEYWORDS.map(compile);

const DEMOTE_KEYWORDS: readonly CompiledKeyword[] =
	GTM_DEMOTE_KEYWORDS.map(compile);

function tierMatchOf(
	lowered: string,
): { tier: number; keyword: string } | null {
	for (const entry of TIER_KEYWORDS) {
		if (matches(lowered, entry)) {
			return { tier: entry.tier, keyword: entry.keyword };
		}
	}
	return null;
}

export function tierOf(title: string): number {
	return tierMatchOf(title.toLowerCase())?.tier ?? GTM_UNMATCHED_TIER;
}

export function orgFunctionOf(title: string): GtmFunction {
	const lowered = title.toLowerCase();
	for (const rule of FUNCTION_RULES) {
		if (rule.keywords.some((keyword) => matches(lowered, keyword))) {
			return rule.id;
		}
	}
	return GTM_FUNCTION.OTHER;
}

export function seniorityRankOf(title: string): number {
	const lowered = title.toLowerCase();
	for (const rule of SENIORITY_RULES) {
		if (rule.keywords.some((keyword) => matches(lowered, keyword))) {
			return rule.rank;
		}
	}
	return GTM_UNRANKED_SENIORITY;
}

export function matchTitle(title: string): TitleMatch | null {
	const lowered = title.toLowerCase();
	if (EXCLUDE_KEYWORDS.some((keyword) => matches(lowered, keyword))) {
		return null;
	}

	const match = tierMatchOf(lowered);
	if (!match) return null;

	const acronym = /^[a-z0-9]+$/.test(match.keyword);
	if (acronym && DEMOTE_KEYWORDS.some((keyword) => matches(lowered, keyword))) {
		return null;
	}

	return {
		tier: match.tier,
		orgFunction: orgFunctionOf(title),
		seniorityRank: seniorityRankOf(title),
	};
}

function escapeChLiteral(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildCoarseTierSql(titleColumnExpr: string): string {
	const column = titleColumnExpr.trim();
	if (!column) {
		throw new Error("buildCoarseTierSql needs a title column expression");
	}

	const branches = TIER_KEYWORDS.map((entry) => {
		const literal = escapeChLiteral(entry.keyword);
		const condition = /^[a-z0-9]+$/.test(entry.keyword)
			? `match(lowerUTF8(${column}), '(^|[^a-z0-9])${literal}($|[^a-z0-9])')`
			: `position(lowerUTF8(${column}), '${literal}') > 0`;
		return `${condition}, ${entry.tier}`;
	});

	return `multiIf(${branches.join(", ")}, ${GTM_UNMATCHED_TIER})`;
}
