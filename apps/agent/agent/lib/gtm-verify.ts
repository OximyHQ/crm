import { GTM_PIPELINE } from "./gtm-config";
import { parseVerifyAnswer } from "./gtm-report";

export type VerifyCandidate = {
	personId: string;
	fullName: string;
	title: string;
};

export type VerifyOutcome = Map<string, "current" | "left" | "unsure">;

export function gtmVerifyConfigured(): boolean {
	return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function verifyStillAtCompany(
	companyName: string,
	candidates: VerifyCandidate[],
): Promise<VerifyOutcome> {
	const outcomes: VerifyOutcome = new Map();
	const key = process.env.OPENROUTER_API_KEY?.trim();
	if (!key || candidates.length === 0) return outcomes;

	const { cap, concurrency } = GTM_PIPELINE.verify;
	const queue = candidates.slice(0, cap);

	const workers = Array.from(
		{ length: Math.min(concurrency, queue.length) },
		async () => {
			while (queue.length > 0) {
				const candidate = queue.shift();
				if (!candidate) break;
				outcomes.set(
					candidate.personId,
					await verifyOne(key, companyName, candidate),
				);
			}
		},
	);
	await Promise.all(workers);

	return outcomes;
}

async function verifyOne(
	key: string,
	companyName: string,
	candidate: VerifyCandidate,
): Promise<"current" | "left" | "unsure"> {
	const today = new Date().toISOString().slice(0, 10);
	const prompt =
		`Today is ${today}. Search the web and answer with dated evidence. ` +
		`Question: does ${candidate.fullName} currently hold the role of ` +
		`"${candidate.title}" at ${companyName}? Check two things: (1) what is ` +
		`${candidate.fullName}'s current role, and (2) who currently holds this ` +
		`role at ${companyName}. Answer false when someone else now holds the ` +
		`role, or when ${candidate.fullName} has moved to another company. ` +
		`Answer true only when you find evidence they are still in the role. ` +
		`With no clear evidence either way, answer "unsure". Reply with ONLY ` +
		`this JSON: {"current": true | false | "unsure", "evidence": "<one ` +
		`short dated sentence>"}`;

	try {
		const response = await fetch(
			`${GTM_PIPELINE.verify.baseUrl}/chat/completions`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${key}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: GTM_PIPELINE.verify.model,
					messages: [{ role: "user", content: prompt }],
					temperature: 0,
				}),
				signal: AbortSignal.timeout(GTM_PIPELINE.verify.callTimeoutMs),
			},
		);
		if (!response.ok) return "unsure";
		const body = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const content = body.choices?.[0]?.message?.content ?? "";
		return parseVerifyAnswer(content);
	} catch {
		return "unsure";
	}
}
