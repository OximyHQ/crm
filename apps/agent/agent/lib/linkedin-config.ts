export const LINKEDIN_DISCOVERY = {
	query: {
		timeoutMs: 20_000,
		maxExecutionSeconds: 15,
		maxThreads: 4,
		cacheSeconds: 300,
		retries: 1,
		retryDelayMs: 300,
	},
	results: {
		currentRoles: 10,
		workHistory: 12,
		education: 8,
		skills: 30,
	},
} as const;
