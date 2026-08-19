export type GtmPeopleResult = {
	saved: number;
	tier1: number;
	tier2: number;
	entities: number;
	truncated: boolean;
	reason?: string;
};

export function gtmPeopleOutcome(result: GtmPeopleResult): string {
	if (result.reason) return result.reason;
	if (result.saved === 0) {
		return `No leadership titles matched across ${result.entities} LinkedIn ${
			result.entities === 1 ? "entity" : "entities"
		}.`;
	}
	const cut = result.truncated ? " More matched than were kept." : "";
	return `Saved ${result.saved} people (${result.tier1} Tier 1, ${result.tier2} Tier 2) from ${result.entities} LinkedIn ${
		result.entities === 1 ? "entity" : "entities"
	}.${cut}`;
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
