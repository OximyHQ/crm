import { GTM_PIPELINE } from "./gtm-config";
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

	const roster = candidates.map((candidate) => ({
		id: candidate.personId,
		name: candidate.fullName,
		title: candidate.title,
	}));

	const prompt =
		`You are mapping the likely org structure of ${companyName}. Below is ` +
		`a list of people from a LinkedIn snapshot, each with an id, name and ` +
		`raw title.\n\n${JSON.stringify(roster)}\n\n` +
		`For EVERY id, decide:\n` +
		`- keep: true when the person is genuine leadership or a departmental ` +
		`decision-maker (founders, C-suite, presidents, VPs, heads and ` +
		`directors of engineering, technology, IT, security, data, AI, ` +
		`platform, infrastructure, and the CFO/COO). false for individual ` +
		`contributors, assistants, interns, office/program staff (e.g. ` +
		`"CEO's Office"), and managers who do not lead a department.\n` +
		`- function: exactly one of "Executive", "Engineering", "IT", ` +
		`"Security", "Data & AI", "Other".\n` +
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
		);
		return parsed.size > 0 ? parsed : null;
	} catch {
		return null;
	}
}
