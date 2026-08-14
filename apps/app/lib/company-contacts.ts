export function companyContactsEmptyState(
	companyName: string,
	running: boolean,
) {
	if (running) {
		return {
			title: "Researching contacts",
			description: "Checking public sources for relevant buyers and champions.",
			running: true,
		} as const;
	}

	return {
		title: "No contacts yet",
		description: `People you engage and prospects you want to reach at ${companyName} appear here.`,
		running: false,
	} as const;
}
