import {
	GTM_FUNCTIONS,
	normalizeCompanyName,
	normalizePersonName,
} from "@crm/validation";

export type GtmPeopleResult = {
	saved: number;
	tier1: number;
	tier2: number;
	entities: number;
	truncated: boolean;
	departed?: number;
	verifiedOut?: number;
	resolvedFuzzily?: boolean;
	reason?: string;
};

const FUZZY_NOTE =
	"Matched by closest company name, not an exact match. Check the company name if these people look wrong.";

export function gtmPeopleOutcome(result: GtmPeopleResult): string {
	if (result.reason) return result.reason;
	if (result.saved === 0) {
		const base = `No leadership titles matched across ${result.entities} LinkedIn ${
			result.entities === 1 ? "entity" : "entities"
		}.`;
		return result.resolvedFuzzily ? `${base} ${FUZZY_NOTE}` : base;
	}
	const notes: string[] = [];
	if (result.truncated) notes.push("More matched than were kept.");
	if (result.departed) {
		notes.push(
			`${result.departed} dropped because their own profile shows the role ended.`,
		);
	}
	if (result.verifiedOut) {
		notes.push(
			`${result.verifiedOut} dropped after a web check found they left.`,
		);
	}
	if (result.resolvedFuzzily) {
		notes.push(FUZZY_NOTE);
	}
	const tail = notes.length > 0 ? ` ${notes.join(" ")}` : "";
	return `Saved ${result.saved} people (${result.tier1} Tier 1, ${result.tier2} Tier 2) from ${result.entities} LinkedIn ${
		result.entities === 1 ? "entity" : "entities"
	}.${tail}`;
}

export type ProfileExperience = {
	title: string;
	company: string;
	companyId: string | null;
	from: string | null;
	to: string | null;
	current: boolean;
};

export type PersonProfile = {
	headline: string | null;
	asOf: string | null;
	experiences: ProfileExperience[];
};

const COMPANY_NOISE = /\(.*?\)|\bformerly\b.*$/gi;

function normalizeCompany(value: string): string {
	return value
		.toLowerCase()
		.replace(COMPANY_NOISE, " ")
		.replace(/[^a-z0-9 ]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function companiesOverlap(a: string, b: string): boolean {
	const left = normalizeCompany(a);
	const right = normalizeCompany(b);
	if (!left || !right) return false;
	return left.includes(right) || right.includes(left);
}

export function departedPerProfile(
	experiences: ProfileExperience[],
	entityNames: string[],
	entityIds: string[] = [],
): boolean {
	const ids = new Set(entityIds);
	const atCompany = experiences.filter(
		(entry) =>
			(entry.companyId !== null && ids.has(entry.companyId)) ||
			entityNames.some((name) => companiesOverlap(entry.company, name)),
	);
	if (atCompany.length === 0) return false;
	return atCompany.every((entry) => !entry.current);
}

export type OrgAnalysis = {
	keep: boolean;
	orgFunction: string;
	seniorityRank: number;
	reportsTo: string | null;
};

const ORG_FUNCTIONS = new Set<string>(GTM_FUNCTIONS);

function extractJsonArray(raw: string): string | null {
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	const body = fenced?.[1] ?? raw;
	const start = body.indexOf("[");
	const end = body.lastIndexOf("]");
	if (start === -1 || end <= start) return null;
	return body.slice(start, end + 1);
}

export function parseOrgAnalysis(
	raw: string,
	validIds: Set<string>,
	reportIds: Set<string> = validIds,
): Map<string, OrgAnalysis> {
	const out = new Map<string, OrgAnalysis>();
	const body = extractJsonArray(raw);
	if (!body) return out;

	let entries: unknown;
	try {
		entries = JSON.parse(body);
	} catch {
		return out;
	}
	if (!Array.isArray(entries)) return out;

	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const row = entry as Record<string, unknown>;
		const id = String(row.id ?? "");
		if (!validIds.has(id)) continue;
		const reportsTo = String(row.reportsTo ?? "");
		const seniority = Number(row.seniority);
		out.set(id, {
			keep: !(row.keep === false || row.keep === "false"),
			orgFunction: ORG_FUNCTIONS.has(String(row.function))
				? String(row.function)
				: "Other",
			seniorityRank:
				Number.isInteger(seniority) && seniority >= 1 && seniority <= 8
					? seniority
					: 8,
			reportsTo:
				reportIds.has(reportsTo) && reportsTo !== id ? reportsTo : null,
		});
	}

	breakCycles(out);
	return out;
}

function breakCycles(entries: Map<string, OrgAnalysis>): void {
	for (const [id, entry] of entries) {
		const seen = new Set<string>([id]);
		let cursor = entry.reportsTo;
		while (cursor) {
			if (seen.has(cursor)) {
				entry.reportsTo = null;
				break;
			}
			seen.add(cursor);
			cursor = entries.get(cursor)?.reportsTo ?? null;
		}
	}
}

export function parseVerifyAnswer(raw: string): "current" | "left" | "unsure" {
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) return "unsure";
	try {
		const parsed = JSON.parse(match[0]) as { current?: unknown };
		if (parsed.current === true) return "current";
		if (parsed.current === false) return "left";
		return "unsure";
	} catch {
		return "unsure";
	}
}

export function nameCandidates(name: string, domain: string | null): string[] {
	const out = new Set<string>();
	const trimmed = name.trim().toLowerCase();
	if (trimmed) out.add(trimmed);
	const root = domain?.trim().toLowerCase().split(".")[0] ?? "";
	if (root.length > 2) out.add(root);
	return [...out];
}

export function parseCrawlDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith("1970")) return null;
	const candidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(
		trimmed,
	)
		? `${trimmed.replace(" ", "T")}Z`
		: trimmed;
	const parsed = new Date(candidate);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeEntityName(value: string): string {
	return normalizeCompanyName(value);
}

export function dedupeByName<
	Row extends { fullName: string; title: string; asOf: Date | null },
>(rows: Row[]): { kept: Row[]; dropped: number } {
	const byKey = new Map<string, Row>();
	let dropped = 0;
	let blanks = 0;
	for (const row of rows) {
		const name = normalizePersonName(row.fullName);
		const key = name
			? `${name}|${normalizePersonName(row.title)}`
			: `__blank_${blanks++}`;
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, row);
			continue;
		}
		dropped += 1;
		const newer =
			(row.asOf?.getTime() ?? 0) > (existing.asOf?.getTime() ?? 0)
				? row
				: existing;
		byKey.set(key, newer);
	}
	return { kept: [...byKey.values()], dropped };
}
