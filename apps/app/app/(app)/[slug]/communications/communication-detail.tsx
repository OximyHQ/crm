"use client";

import Phone from "@carbon/icons-react/es/Phone";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Separator } from "@crm/ui/components/separator";
import { Spinner } from "@crm/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { quoWebDialerUrl } from "@/lib/quo-web-dialer";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Communication = RouterOutputs["communications"]["byId"];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	dateStyle: "medium",
	timeStyle: "short",
};

export function CommunicationDetail({ id }: { id: string }) {
	const trpc = useTRPC();
	const communication = useQuery(trpc.communications.byId.queryOptions({ id }));
	if (communication.isLoading || !communication.data) {
		return (
			<div className="flex justify-center py-16">
				<Spinner />
			</div>
		);
	}
	return <CommunicationContent communication={communication.data} />;
}

function CommunicationContent({
	communication,
}: {
	communication: Communication;
}) {
	const external = communication.participants.find(
		(participant) => participant.role === "EXTERNAL",
	);
	const contact = external?.contact;
	const phone = external?.phoneE164 ?? null;
	const name = contact
		? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
		: (phone ?? "Unknown number");

	return (
		<article className="flex flex-col gap-5 p-5">
			<header className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="font-medium text-xl">{name}</h2>
					<Badge variant="outline" className="capitalize">
						{communication.kind.toLowerCase()}
					</Badge>
					{communication.matchStatus === "NEEDS_REVIEW" ? (
						<Badge variant="destructive">Needs review</Badge>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
					{phone ? <span className="tabular-nums">{phone}</span> : null}
					<span className="capitalize">
						{communication.direction?.toLowerCase() ?? "Unknown direction"}
					</span>
					{communication.status ? <span>{communication.status}</span> : null}
					{communication.durationSeconds !== null ? (
						<span>{formatDuration(communication.durationSeconds)}</span>
					) : null}
					<LocalDateTime
						date={communication.occurredAt}
						options={DATE_OPTIONS}
					/>
				</div>
				<div className="flex flex-wrap gap-2">
					{phone ? (
						<Button asChild variant="outline" size="sm">
							<a href={quoWebDialerUrl(phone)} target="_blank" rel="noreferrer">
								<Icon icon={Phone} data-icon="inline-start" />
								Call with Quo
							</a>
						</Button>
					) : null}
					{communication.sourceUrl ? (
						<Button asChild variant="ghost" size="sm">
							<a
								href={communication.sourceUrl}
								target="_blank"
								rel="noreferrer"
							>
								Open in Quo
							</a>
						</Button>
					) : null}
				</div>
			</header>

			{communication.matchStatus === "NEEDS_REVIEW" ? (
				<ReviewCommunication communication={communication} phone={phone} />
			) : null}

			{communication.body ? (
				<section className="space-y-2">
					<h3 className="font-medium text-sm">Message</h3>
					<p className="whitespace-pre-wrap text-sm">{communication.body}</p>
				</section>
			) : null}

			{communication.recordings.length > 0 ? (
				<section className="space-y-3">
					<h3 className="font-medium text-sm">Recordings</h3>
					{communication.recordings.map((recording) => (
						<div className="space-y-1" key={recording.id}>
							<audio className="h-9 w-full" controls preload="none">
								<source src={recording.url} />
								<track kind="captions" />
							</audio>
							{recording.transcript ? (
								<p className="whitespace-pre-wrap text-muted-foreground text-xs">
									{recording.transcript}
								</p>
							) : null}
						</div>
					))}
				</section>
			) : null}

			{communication.summary ? (
				<section className="space-y-2">
					<h3 className="font-medium text-sm">Summary</h3>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">
						{communication.summary}
					</p>
				</section>
			) : null}

			{communication.nextSteps ? (
				<section className="space-y-2">
					<h3 className="font-medium text-sm">Next steps</h3>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">
						{communication.nextSteps}
					</p>
				</section>
			) : null}

			{communication.transcript ? (
				<section className="space-y-2">
					<h3 className="font-medium text-sm">Transcript</h3>
					<div className="max-h-[32rem] overflow-y-auto rounded-md bg-muted/60 p-4">
						<p className="whitespace-pre-wrap text-sm leading-relaxed">
							{communication.transcript}
						</p>
					</div>
				</section>
			) : null}
		</article>
	);
}

function ReviewCommunication({
	communication,
	phone,
}: {
	communication: Communication;
	phone: string | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [mode, setMode] = useState<"existing" | "new">("existing");
	const [q, setQ] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const firstNameId = useId();
	const lastNameId = useId();
	const emailId = useId();
	const contacts = useQuery(
		trpc.communications.contactOptions.queryOptions({ q }),
	);
	const resolve = useMutation(
		trpc.communications.resolve.mutationOptions({
			onSuccess: async (result) => {
				await cache.communications();
				toast.success(
					result.resolved === 1
						? "Communication attached."
						: `${result.resolved} communications attached.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const create = useMutation(
		trpc.contacts.create.mutationOptions({
			onSuccess: (contact) => {
				resolve.mutate({
					action: "attach",
					communicationId: communication.id,
					contactId: contact.id,
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<section className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
			<div>
				<h3 className="font-medium text-sm">Map this number</h3>
				<p className="text-muted-foreground text-xs">
					Attaching {phone ?? "this number"} also attaches its unresolved
					history.
				</p>
			</div>
			<Tabs
				value={mode}
				onValueChange={(value) => setMode(value === "new" ? "new" : "existing")}
			>
				<TabsList>
					<TabsTrigger value="existing">Existing contact</TabsTrigger>
					<TabsTrigger value="new">New contact</TabsTrigger>
				</TabsList>
			</Tabs>

			{mode === "existing" ? (
				<div className="space-y-2">
					<Input
						value={q}
						onChange={(event) => setQ(event.target.value)}
						placeholder="Search contacts…"
						aria-label="Search contacts"
					/>
					<div className="max-h-52 overflow-y-auto rounded-md border bg-background">
						{(contacts.data ?? []).map((contact) => (
							<Button
								variant="ghost"
								className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
								disabled={resolve.isPending}
								onClick={() =>
									resolve.mutate({
										action: "attach",
										communicationId: communication.id,
										contactId: contact.id,
									})
								}
								key={contact.id}
							>
								<span className="min-w-0">
									<span className="block truncate font-medium">
										{[contact.firstName, contact.lastName]
											.filter(Boolean)
											.join(" ")}
									</span>
									<span className="block truncate text-muted-foreground">
										{contact.email ?? contact.company?.name ?? "No email"}
									</span>
								</span>
							</Button>
						))}
					</div>
				</div>
			) : (
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							firstName,
							lastName: lastName || undefined,
							email: email || undefined,
							phone: phone ?? undefined,
						});
					}}
				>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor={firstNameId}>First name</FieldLabel>
							<Input
								id={firstNameId}
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={lastNameId}>Last name</FieldLabel>
							<Input
								id={lastNameId}
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor={emailId}>Email</FieldLabel>
						<Input
							id={emailId}
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</Field>
					<Button
						type="submit"
						disabled={
							create.isPending || resolve.isPending || !firstName.trim()
						}
					>
						{create.isPending || resolve.isPending ? <Spinner /> : null}
						Create and attach
					</Button>
				</form>
			)}

			<Separator />
			<Button
				variant="ghost"
				size="sm"
				disabled={resolve.isPending}
				onClick={() =>
					resolve.mutate({
						action: "ignore",
						communicationId: communication.id,
					})
				}
			>
				Ignore this communication
			</Button>
		</section>
	);
}

function formatDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainder = Math.round(seconds % 60);
	return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
