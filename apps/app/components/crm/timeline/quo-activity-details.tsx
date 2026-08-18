export function QuoActivityDetails({
	url,
	status,
	direction,
	duration,
	recordings,
	nextSteps,
	transcript,
	phoneNumbers,
}: {
	url: string | null;
	status: string | null;
	direction: string | null;
	duration: number | null;
	recordings: { url: string; durationSeconds: number | null; type: string }[];
	nextSteps: string[];
	phoneNumbers: string[];
	transcript: {
		content: string;
		start: number;
		end: number;
		identifier: string;
		userId: string | null;
	}[];
}) {
	const facts = [
		direction,
		status,
		duration === null ? null : formatDuration(duration),
	].filter(Boolean);

	return (
		<div className="flex flex-col gap-2 text-xs">
			{phoneNumbers.length > 0 ? (
				<p className="tabular-nums text-muted-foreground">
					{phoneNumbers.join(", ")}
				</p>
			) : null}
			{facts.length > 0 ? (
				<p className="capitalize text-muted-foreground">{facts.join(" · ")}</p>
			) : null}
			{recordings.map((recording) => (
				<audio
					className="h-8 w-full max-w-md"
					controls
					preload="none"
					src={recording.url}
					key={recording.url}
				>
					<track kind="captions" />
				</audio>
			))}
			{nextSteps.length > 0 ? (
				<div>
					<p className="font-medium">Next steps</p>
					<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
						{nextSteps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ul>
				</div>
			) : null}
			{transcript.length > 0 ? (
				<details>
					<summary className="cursor-pointer font-medium">Transcript</summary>
					<div className="mt-2 space-y-2 border-l pl-3 text-muted-foreground">
						{transcript.map((line) => (
							<p key={`${line.start}:${line.identifier}`}>
								<span className="font-medium text-foreground">
									{line.identifier}:
								</span>{" "}
								{line.content}
							</p>
						))}
					</div>
				</details>
			) : null}
			{url ? (
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					className="w-fit text-muted-foreground underline underline-offset-3 hover:text-foreground"
				>
					Open in Quo
				</a>
			) : null}
		</div>
	);
}

function formatDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainder = Math.round(seconds % 60);
	return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
