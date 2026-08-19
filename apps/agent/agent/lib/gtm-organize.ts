import { GTM_FUNCTIONS } from "@crm/validation";
import { GTM_LEADER_MAX_RANK, GTM_PIPELINE } from "./gtm-config";
import { type OrgAnalysis, parseOrgAnalysis } from "./gtm-report";

export type OrgCandidate = {
	personId: string;
	fullName: string;
	title: string;
};

export function gtmOrganizeConfigured(): boolean {
	return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function analyzeOrg(
	companyName: string,
	candidates: OrgCandidate[],
): Promise<Map<string, OrgAnalysis> | null> {
	const key = process.env.OPENROUTER_API_KEY?.trim();
	if (!key || candidates.length === 0) return null;

	const merged = new Map<string, OrgAnalysis>();
	const leaders: OrgCandidate[] = [];
	for (
		let start = 0;
		start < candidates.length;
		start += GTM_PIPELINE.hierarchy.chunk
	) {
		const chunk = candidates.slice(start, start + GTM_PIPELINE.hierarchy.chunk);
		const parsed =
			(await analyzeChunk(key, companyName, chunk, leaders)) ??
			(await analyzeChunk(key, companyName, chunk, leaders));
		if (!parsed) return null;
		for (const [id, entry] of parsed) {
			merged.set(id, entry);
			if (entry.keep && entry.seniorityRank <= GTM_LEADER_MAX_RANK) {
				const candidate = chunk.find((row) => row.personId === id);
				if (candidate) leaders.push(candidate);
			}
		}
	}

	return merged.size > 0 ? merged : null;
}

async function analyzeChunk(
	key: string,
	companyName: string,
	candidates: OrgCandidate[],
	leaders: OrgCandidate[],
): Promise<Map<string, OrgAnalysis> | null> {
	const roster = candidates.map((candidate) => ({
		id: candidate.personId,
		name: candidate.fullName,
		title: candidate.title,
	}));
	const leaderList = leaders.map((leader) => ({
		id: leader.personId,
		name: leader.fullName,
		title: leader.title,
	}));
	const leaderBlock =
		leaderList.length > 0
			? `\n\nLeaders already mapped in an earlier batch, valid ONLY as ` +
				`reportsTo targets, do not output entries for them:\n` +
				`${JSON.stringify(leaderList)}\n`
			: "";

	const prompt =
		`You are mapping the likely org structure of ${companyName}. Below is ` +
		`a list of people from a LinkedIn snapshot, each with an id, name and ` +
		`raw title.\n\n${JSON.stringify(roster)}${leaderBlock}\n\n` +
		`For EVERY id, decide:\n` +
		`- keep: true when the person is a decision-maker a company selling ` +
		`AI infrastructure would talk to: founders, the CEO/CFO/COO/president, ` +
		`and the C-suite, VPs, heads and directors of engineering, technology, ` +
		`IT, security, data, AI, platform and infrastructure. false for ` +
		`everyone else — individual contributors, assistants, office/program ` +
		`staff (e.g. "CEO's Office"), managers who do not lead a department, ` +
		`and leaders of sales, marketing, HR, people, talent, growth, legal, ` +
		`corporate development or delivery, even at chief level. When two ids ` +
		`are clearly the same human (same or near-identical name), keep only ` +
		`one and mark the rest false.\n` +
		`- function: exactly one of ${GTM_FUNCTIONS.map((f) => `"${f}"`).join(", ")}.\n` +
		`- seniority: 1 founder/CEO, 2 C-suite, 3 EVP/SVP, 4 VP, ` +
		`5 head of, 6 director, 7 manager, 8 other.\n` +
		`- reportsTo: the id of their most likely direct manager FROM THIS ` +
		`LIST, or null when no listed person is plausibly above them. The ` +
		`CEO/top founder is null. Use real-world org logic: engineering ` +
		`directors report to a VP of engineering or CTO when one is listed, ` +
		`the C-suite reports to the CEO, and so on. Never invent ids.\n\n` +
		`Reply with ONLY a JSON array, one object per input id: ` +
		`[{"id": "...", "keep": true, "function": "...", "seniority": 2, ` +
		`"reportsTo": "..." | null}, ...]`;

	try {
		const response = await fetch(
			`${GTM_PIPELINE.hierarchy.baseUrl}/chat/completions`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${key}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: GTM_PIPELINE.hierarchy.model,
					messages: [{ role: "user", content: prompt }],
					temperature: 0,
				}),
				signal: AbortSignal.timeout(GTM_PIPELINE.hierarchy.callTimeoutMs),
			},
		);
		if (!response.ok) return null;
		const body = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const content = body.choices?.[0]?.message?.content ?? "";
		const parsed = parseOrgAnalysis(
			content,
			new Set(candidates.map((candidate) => candidate.personId)),
			new Set(
				[...candidates, ...leaders].map((candidate) => candidate.personId),
			),
		);
		return parsed.size > 0 ? parsed : null;
	} catch {
		return null;
	}
}
