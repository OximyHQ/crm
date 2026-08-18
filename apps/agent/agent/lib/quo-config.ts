export const QUO = {
	apiVersion: "2026-03-30",
	apiBase: "https://api.quo.com",
	v1ApiBase: "https://api.quo.com/v1",
	requestTimeoutMs: 25_000,
	contacts: { pageSize: 50, source: "oximy-crm", label: "CRM" },
	webhook: {
		label: "Oximy CRM activity sync",
		events: [
			"call.completed",
			"call.recording.completed",
			"call.summary.completed",
			"call.transcript.completed",
			"call.voicemail.completed",
			"message.received",
			"message.delivered",
			"message.failed",
			"message.undelivered",
		] as const,
	},
} as const;
