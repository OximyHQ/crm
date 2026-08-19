export type GtmKeywordRule = {
	keyword: string;
	unless?: readonly string[];
};

export type GtmKeyword = string | GtmKeywordRule;

export const GTM_UNMATCHED_RANK = 9;

const OFFICE_STAFF = [
	"ceo's office",
	"ceo office",
	"ceos office",
	"office of the ceo",
	"founder's office",
	"founders office",
	"office of the founder",
] as const;

export const GTM_SENIORITY_BANDS: readonly {
	rank: number;
	keywords: readonly GtmKeyword[];
}[] = [
	{
		rank: 1,
		keywords: [
			{ keyword: "founder", unless: OFFICE_STAFF },
			"cofounder",
			{ keyword: "ceo", unless: OFFICE_STAFF },
			"chief executive officer",
			{ keyword: "president", unless: ["vice president", "vp"] },
		],
	},
	{
		rank: 2,
		keywords: [
			{ keyword: "chief", unless: OFFICE_STAFF },
			"cio",
			"cto",
			"cfo",
			"coo",
			"ciso",
			"cmo",
			"cdo",
		],
	},
	{
		rank: 3,
		keywords: [
			"evp",
			"svp",
			"executive vice president",
			"senior vice president",
		],
	},
	{ rank: 4, keywords: ["vp", "vice president"] },
	{ rank: 5, keywords: ["head of"] },
	{ rank: 6, keywords: ["director"] },
] as const;

export const GTM_EXCLUDE_KEYWORDS: readonly string[] = [
	"assistant",
	"intern",
	"secretary",
];

export const GTM_DEMOTE_KEYWORDS: readonly string[] = [
	"manager",
	"analyst",
	"engineer",
	"specialist",
	"coordinator",
	"associate",
];

export const GTM_FALLBACK_MAX_RANK = 4;

export const GTM_PIPELINE = {
	resolve: { candidateLimit: 25, entityLimit: 10 },
	roster: { coarseLimit: 3000, maxRank: 6 },
	keep: { limit: 300 },
	profile: { experienceLimit: 15 },
	save: { updateChunk: 25 },
	verify: {
		cap: 40,
		concurrency: 4,
		callTimeoutMs: 20_000,
		model: "google/gemini-3-flash-preview:online",
		baseUrl: "https://openrouter.ai/api/v1",
	},
	hierarchy: {
		cap: 150,
		callTimeoutMs: 90_000,
		model: "google/gemini-3-flash-preview",
		baseUrl: "https://openrouter.ai/api/v1",
	},
} as const;
