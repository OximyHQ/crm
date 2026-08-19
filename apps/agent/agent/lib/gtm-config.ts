export const GTM_FUNCTION = {
	EXECUTIVE: "Executive",
	SECURITY: "Security",
	DATA_AI: "Data & AI",
	IT: "IT",
	ENGINEERING: "Engineering",
	OTHER: "Other",
} as const;

export type GtmFunction = (typeof GTM_FUNCTION)[keyof typeof GTM_FUNCTION];

export type GtmKeywordRule = {
	keyword: string;
	unless?: readonly string[];
};

export type GtmKeyword = string | GtmKeywordRule;

export type GtmTierConfig = {
	tier: number;
	label: string;
	keywords: readonly GtmKeyword[];
};

export const GTM_UNMATCHED_TIER = 9;

const PRESIDENT: GtmKeywordRule = {
	keyword: "president",
	unless: ["vice president", "vp"],
};

const CEO_OFFICE_TITLES = [
	"ceo's office",
	"ceo office",
	"ceos office",
	"office of the ceo",
] as const;

const CEO: GtmKeywordRule = {
	keyword: "ceo",
	unless: [...CEO_OFFICE_TITLES],
};

const FOUNDER: GtmKeywordRule = {
	keyword: "founder",
	unless: ["founder's office", "office of the founder"],
};

export const GTM_ICP_TIERS: readonly GtmTierConfig[] = [
	{
		tier: 1,
		label: "Top decision-makers / budget owners",
		keywords: [
			"chief executive officer",
			CEO,
			FOUNDER,
			"cofounder",
			PRESIDENT,
			"chief operating officer",
			"coo",
			"chief financial officer",
			"cfo",
			"chief information officer",
			"cio",
			"chief technology officer",
			"chief technical officer",
			"cto",
			"chief information security officer",
			"chief security officer",
			"ciso",
			"chief digital officer",
			"chief data officer",
			"chief ai officer",
			"chief artificial intelligence officer",
			"vp engineering",
			"vp of engineering",
			"vice president engineering",
			"vice president of engineering",
			"svp engineering",
			"svp of engineering",
			"senior vice president engineering",
			"senior vice president of engineering",
			"evp engineering",
			"evp of engineering",
			"vp technology",
			"vp of technology",
			"head of ai",
			"head of artificial intelligence",
			"head of machine learning",
			"head of ml",
			"vp of ai",
			"vp of artificial intelligence",
			"vp of machine learning",
			"head of data",
			"vp of data",
			"head of data science",
			"head of platform",
			"head of platform engineering",
			"head of infrastructure",
			"vp of infrastructure",
			"head of cloud",
			"head of developer productivity",
			"head of developer experience",
			"head of devex",
			"head of devprod",
			"head of security",
			"head of information security",
			"head of cybersecurity",
			"vp security",
			"vp of security",
			"director of security",
			"director of information security",
		],
	},
	{
		tier: 2,
		label: "Departmental leaders / strong influencers",
		keywords: [
			"vp it",
			"vp of it",
			"vp information technology",
			"vice president it",
			"vice president of it",
			"vice president of information technology",
			"director of it",
			"director of information technology",
			"it director",
			"director of engineering",
			"engineering director",
			"head of it",
			"head of information technology",
			"software engineering manager",
			"founders office",
			"founder's office",
			...CEO_OFFICE_TITLES,
			"chief of staff",
			"head of staff",
			"chief architect",
			"head of architecture",
		],
	},
];

export const GTM_FUNCTION_RULES: readonly {
	id: GtmFunction;
	keywords: readonly GtmKeyword[];
}[] = [
	{
		id: GTM_FUNCTION.EXECUTIVE,
		keywords: [
			"chief executive officer",
			CEO,
			FOUNDER,
			"cofounder",
			PRESIDENT,
			"chief operating officer",
			"coo",
			"chief financial officer",
			"cfo",
			"chief of staff",
			"head of staff",
			"founders office",
		],
	},
	{
		id: GTM_FUNCTION.SECURITY,
		keywords: ["security", "ciso", "cyber", "cybersecurity", "infosec"],
	},
	{
		id: GTM_FUNCTION.DATA_AI,
		keywords: [
			"chief data officer",
			"chief ai officer",
			"chief artificial intelligence officer",
			"artificial intelligence",
			"machine learning",
			"data science",
			"head of data",
			"vp of data",
			"ai",
			"ml",
		],
	},
	{
		id: GTM_FUNCTION.IT,
		keywords: [
			"chief information officer",
			"cio",
			"chief digital officer",
			"information technology",
			"it",
		],
	},
	{
		id: GTM_FUNCTION.ENGINEERING,
		keywords: [
			"chief technology officer",
			"chief technical officer",
			"cto",
			"engineering",
			"platform",
			"infrastructure",
			"cloud",
			"devex",
			"devprod",
			"developer",
			"technology",
			"architect",
			"architecture",
		],
	},
];

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

export const GTM_SENIORITY_RULES: readonly {
	rank: number;
	label: string;
	keywords: readonly GtmKeyword[];
}[] = [
	{
		rank: 1,
		label: "Founder / CEO",
		keywords: [FOUNDER, "cofounder", CEO, "chief executive officer", PRESIDENT],
	},
	{
		rank: 2,
		label: "C-suite",
		keywords: ["chief", "cio", "cto", "cfo", "coo", "ciso", "cmo"],
	},
	{
		rank: 3,
		label: "EVP / SVP",
		keywords: [
			"evp",
			"svp",
			"executive vice president",
			"senior vice president",
		],
	},
	{ rank: 4, label: "VP", keywords: ["vp", "vice president"] },
	{ rank: 5, label: "Head of", keywords: ["head of"] },
	{ rank: 6, label: "Director", keywords: ["director"] },
	{ rank: 7, label: "Manager", keywords: ["manager"] },
];

export const GTM_UNRANKED_SENIORITY = 8;

export const GTM_PIPELINE = {
	resolve: { candidateLimit: 25, entityLimit: 10 },
	roster: { coarseLimit: 3000 },
	keep: { limit: 300 },
	profile: { experienceLimit: 15 },
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
	query: {
		maxExecutionSeconds: 25,
		maxThreads: 4,
		requestTimeoutMs: 30_000,
		retries: 1,
		retryBaseMs: 300,
	},
} as const;

export const GTM_TRANSIENT_ERRORS = [
	"502",
	"503",
	"ECONNRESET",
	"ETIMEDOUT",
	"aborted",
	"socket hang up",
] as const;
