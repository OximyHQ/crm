"use client";

import Phone from "@carbon/icons-react/es/Phone";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import {
	AsyncButtonContent,
	useAsyncAction,
} from "@crm/ui/components/async-action";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type QuoStatus = {
	connected: boolean;
	canManage: boolean;
	keyHint: string | null;
	webhookId: string | null;
	connectedAt: string | null;
	lastSyncedAt: string | null;
	lastError: string | null;
	phoneNumbers: {
		id: string;
		name: string;
		number: string;
		formattedNumber: string;
		restrictions: {
			calling: Record<string, string>;
			messaging: Record<string, string>;
		};
	}[];
	userCount: number;
	imported: number;
	needsReview: number;
	pending: number;
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

export function QuoConnection({
	slug,
	status,
}: {
	slug: string;
	status: QuoStatus;
}) {
	return status.connected ? (
		<ConnectedQuo slug={slug} status={status} />
	) : (
		<ConnectQuo canManage={status.canManage} />
	);
}

function ConnectQuo({ canManage }: { canManage: boolean }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const [apiKey, setApiKey] = useState("");
	const connect = useMutation(
		trpc.quo.connect.mutationOptions({
			onSuccess: async () => {
				await cache.quo();
				toast.success("Quo connected for the whole account.");
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const action = useAsyncAction({
		action: () => connect.mutateAsync({ apiKey }),
	});

	return (
		<>
			<header className="flex flex-col gap-3 px-(--spacing-block-inline)">
				<div className="flex items-center gap-3">
					<Phone className="size-6" />
					<h1 className="font-medium text-xl">Quo</h1>
					<span className="ml-auto text-muted-foreground text-sm">
						Not connected
					</span>
				</div>
				<p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
					One account connection imports calls and messages from every Quo user
					and number.
				</p>
			</header>

			<section className="border-y px-(--spacing-block-inline) py-5">
				<div className="flex max-w-xl flex-col gap-2">
					<Label htmlFor="quo-api-key">Quo API key</Label>
					<Input
						id="quo-api-key"
						type="password"
						autoComplete="off"
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
						disabled={!canManage || action.pending}
					/>
					<p className="text-muted-foreground text-xs">
						Create one key in Quo settings. The CRM registers one account
						webhook.
					</p>
				</div>
			</section>

			<div className="flex items-center gap-4 px-(--spacing-block-inline)">
				<Button
					disabled={!canManage || action.pending || apiKey.trim().length < 32}
					onClick={() => void action.run()}
				>
					<AsyncButtonContent status={action.status} pendingLabel="Connecting…">
						Connect Quo
					</AsyncButtonContent>
				</Button>
				<p className="text-muted-foreground text-xs">
					{canManage
						? "The CRM starts receiving new activity immediately."
						: "Only an owner or an admin can connect Quo."}
				</p>
			</div>
		</>
	);
}

function ConnectedQuo({ slug, status }: { slug: string; status: QuoStatus }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const [confirming, setConfirming] = useState(false);
	const disconnect = useMutation(
		trpc.quo.disconnect.mutationOptions({
			onSuccess: async () => {
				await cache.quo();
				toast.success("Quo disconnected.");
				router.push(`/${slug}/settings/connections`);
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const action = useAsyncAction({ action: () => disconnect.mutateAsync() });

	return (
		<>
			<header className="flex flex-col gap-2 px-(--spacing-block-inline)">
				<div className="flex items-center gap-3">
					<Phone className="size-6" />
					<h1 className="font-medium text-xl">Quo</h1>
					<StatusIndicator tone="success" size="sm" label="Connected" />
					<Button
						className="ml-auto"
						variant="outline"
						size="sm"
						disabled={!status.canManage}
						onClick={() => setConfirming(true)}
					>
						Disconnect
					</Button>
				</div>
				<p className="text-muted-foreground text-sm">
					New calls, messages, recordings, summaries and transcripts enter the
					CRM automatically.
				</p>
			</header>

			<section className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2">
				<StatusCell
					label="Imported activities"
					value={String(status.imported)}
				/>
				<StatusCell
					label="Needs contact review"
					value={String(status.needsReview)}
				/>
				<StatusCell label="Waiting events" value={String(status.pending)} />
				<StatusCell label="Quo users" value={String(status.userCount)} />
				<StatusCell label="API access" value={status.keyHint ?? "Stored key"} />
				<StatusCell
					label="Last activity"
					value={
						status.lastSyncedAt ? (
							<LocalDateTime
								date={status.lastSyncedAt}
								options={DATE_OPTIONS}
							/>
						) : (
							"Not yet"
						)
					}
				/>
				<StatusCell
					label="Latest error"
					value={status.lastError ?? "None"}
					tone={status.lastError ? "error" : "default"}
				/>
			</section>

			{status.phoneNumbers.map((number) => (
				<section
					className="flex flex-col gap-2 border-y px-(--spacing-block-inline) py-4 text-sm"
					key={number.id}
				>
					<div className="flex items-center justify-between gap-4">
						<p className="font-medium">{number.name}</p>
						<p className="tabular-nums text-muted-foreground">
							{number.formattedNumber}
						</p>
					</div>
					<p className="text-muted-foreground text-xs">
						US calling: {number.restrictions.calling.US ?? "unknown"}. US
						messaging: {number.restrictions.messaging.US ?? "unknown"}.
					</p>
				</section>
			))}

			{status.needsReview > 0 ? (
				<section className="flex items-center justify-between gap-4 border-y px-(--spacing-block-inline) py-5">
					<div>
						<h2 className="font-medium text-sm">Needs contact review</h2>
						<p className="text-muted-foreground text-xs">
							{status.needsReview} communications need a contact.
						</p>
					</div>
					<Button asChild variant="outline" size="sm">
						<Link href={`/${slug}/communications?filter=review`}>
							Open review queue
						</Link>
					</Button>
				</section>
			) : null}

			<p className="px-(--spacing-block-inline) text-muted-foreground text-xs leading-relaxed">
				Contact phone links open the Quo web dialer with the number ready.
				<Link
					href="https://support.quo.com/core-concepts/calling/making-calls"
					target="_blank"
					className="ml-1 font-medium text-foreground underline underline-offset-4"
				>
					Quo calling guide
				</Link>
			</p>

			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Disconnect Quo?</AlertDialogTitle>
						<AlertDialogDescription>
							New activity stops entering the CRM. Imported activities stay.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={action.pending}>
							Cancel
						</AlertDialogCancel>
						<Button
							variant="destructive"
							disabled={action.pending}
							onClick={() => void action.run()}
						>
							<AsyncButtonContent
								status={action.status}
								pendingLabel="Disconnecting…"
							>
								Disconnect
							</AsyncButtonContent>
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function StatusCell({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: React.ReactNode;
	tone?: "default" | "error";
}) {
	return (
		<div className="flex min-h-20 flex-col gap-1 bg-background px-(--spacing-block-inline) py-4">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className={tone === "error" ? "text-destructive text-sm" : "text-sm"}>
				{value}
			</p>
		</div>
	);
}
