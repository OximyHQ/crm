"use client";

import DocumentAudio from "@carbon/icons-react/es/DocumentAudio";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDateTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type GranolaStatus = {
	connected: boolean;
	canManage: boolean;
	keyHint: string | null;
	folderId: string | null;
	scope: "personal" | "public" | null;
	connectedAt: string | null;
	lastSyncedAt: string | null;
	lastError: string | null;
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

export function GranolaConnection({
	slug,
	status,
}: {
	slug: string;
	status: GranolaStatus;
}) {
	return status.connected ? (
		<ConnectedGranola slug={slug} status={status} />
	) : (
		<ConnectGranola canManage={status.canManage} />
	);
}

function ConnectGranola({ canManage }: { canManage: boolean }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const [apiKey, setApiKey] = useState("");
	const [scope, setScope] = useState<"personal" | "public">("personal");
	const connect = useMutation(
		trpc.granola.connect.mutationOptions({
			onSuccess: async () => {
				await cache.granola();
				toast.success(
					"Granola connected. The Customer Calls import is queued.",
				);
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const action = useAsyncAction({
		action: () => connect.mutateAsync({ apiKey, scope }),
	});

	return (
		<>
			<header className="flex flex-col gap-3 px-(--spacing-block-inline)">
				<div className="flex items-center gap-3">
					<DocumentAudio className="size-6" />
					<h1 className="font-medium text-xl">Granola</h1>
					<span className="ml-auto text-muted-foreground text-sm">
						Not connected
					</span>
				</div>
				<p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
					The CRM imports every note in your Customer Calls folder. It matches
					attendee emails to contacts and one clear open deal.
				</p>
			</header>

			<section className="grid gap-4 border-y px-(--spacing-block-inline) py-5 md:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor="granola-api-key">Granola API key</Label>
					<Input
						id="granola-api-key"
						type="password"
						autoComplete="off"
						placeholder="grn_…"
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
						disabled={!canManage || action.pending}
					/>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Create the key in Granola Settings, under Connectors and API keys.
					</p>
				</div>
				<div className="flex flex-col gap-2">
					<Label>API key scope</Label>
					<Select
						value={scope}
						onValueChange={(value) => setScope(value as "personal" | "public")}
						disabled={!canManage || action.pending}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="personal">Personal</SelectItem>
							<SelectItem value="public">Public</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Use Personal for a private folder. Use Public for a
						workspace-visible folder.
					</p>
				</div>
				<div className="flex flex-col gap-2">
					<Label>Folder</Label>
					<p className="text-sm">Customer Calls</p>
					<p className="text-muted-foreground text-xs leading-relaxed">
						The CRM finds the exact folder name and includes its child folders.
					</p>
				</div>
			</section>

			<div className="flex items-center gap-4 px-(--spacing-block-inline)">
				<Button
					disabled={!canManage || action.pending || apiKey.trim().length < 8}
					onClick={() => void action.run()}
				>
					<AsyncButtonContent status={action.status} pendingLabel="Connecting…">
						Connect Granola
					</AsyncButtonContent>
				</Button>
				<p className="text-muted-foreground text-xs">
					{canManage
						? "The first import starts after Granola accepts the webhook."
						: "Only an owner or an admin can connect Granola."}
				</p>
			</div>
		</>
	);
}

function ConnectedGranola({
	slug,
	status,
}: {
	slug: string;
	status: GranolaStatus;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const [confirming, setConfirming] = useState(false);
	const backfill = useMutation(
		trpc.granola.backfill.mutationOptions({
			onSuccess: async () => {
				await cache.granola();
				toast.success("Granola import queued.");
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const disconnect = useMutation(
		trpc.granola.disconnect.mutationOptions({
			onSuccess: async () => {
				await cache.granola();
				toast.success("Granola disconnected.");
				router.push(`/${slug}/settings/connections`);
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const backfillAction = useAsyncAction({
		action: () => backfill.mutateAsync(),
	});
	const disconnectAction = useAsyncAction({
		action: () => disconnect.mutateAsync(),
	});

	return (
		<>
			<header className="flex flex-col gap-2 px-(--spacing-block-inline)">
				<div className="flex items-center gap-3">
					<DocumentAudio className="size-6" />
					<h1 className="font-medium text-xl">Granola</h1>
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
					New Customer Calls notes enter the CRM automatically. Existing notes
					enter through the import queue.
				</p>
			</header>

			<section className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2">
				<StatusCell
					label="Imported activities"
					value={String(status.imported)}
				/>
				<StatusCell
					label="Needs deal review"
					value={String(status.needsReview)}
				/>
				<StatusCell label="Waiting tasks" value={String(status.pending)} />
				<StatusCell label="Folder ID" value={status.folderId ?? "Unknown"} />
				<StatusCell
					label="API access"
					value={`${status.keyHint ?? "Stored key"} · ${status.scope ?? "unknown"}`}
				/>
				<StatusCell
					label="Last imported"
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

			{status.needsReview > 0 ? <GranolaReviewQueue /> : null}

			<div className="flex flex-wrap items-center gap-4 border-y px-(--spacing-block-inline) py-5">
				<Button
					variant="outline"
					disabled={backfillAction.pending}
					onClick={() => void backfillAction.run()}
				>
					<AsyncButtonContent
						status={backfillAction.status}
						pendingLabel="Queueing…"
						successLabel="Queued"
					>
						Import folder again
					</AsyncButtonContent>
				</Button>
				<p className="text-muted-foreground text-xs">
					Duplicate note IDs update their existing CRM activity.
				</p>
			</div>

			<p className="px-(--spacing-block-inline) text-muted-foreground text-xs leading-relaxed">
				The CRM uses exact attendee emails. Multiple open deals remain
				unassigned.
				<Link
					href="https://docs.granola.ai/introduction"
					target="_blank"
					className="ml-1 font-medium text-foreground underline underline-offset-4"
				>
					Granola API documentation
				</Link>
			</p>

			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Disconnect Granola?</AlertDialogTitle>
						<AlertDialogDescription>
							New notes stop entering the CRM. Imported meeting activities stay.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={disconnectAction.pending}>
							Cancel
						</AlertDialogCancel>
						<Button
							variant="destructive"
							disabled={disconnectAction.pending}
							onClick={() => void disconnectAction.run()}
						>
							<AsyncButtonContent
								status={disconnectAction.status}
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

function GranolaReviewQueue() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [selected, setSelected] = useState<Record<string, string>>({});
	const review = useQuery(trpc.granola.review.queryOptions());
	const assign = useMutation(
		trpc.granola.assign.mutationOptions({
			onSuccess: async () => {
				await cache.granola();
				toast.success("Granola activity assigned to the deal.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!review.data || review.data.length === 0) return null;

	return (
		<section className="flex flex-col gap-3 border-y px-(--spacing-block-inline) py-5">
			<div>
				<h2 className="font-medium text-sm">Calls that need a deal</h2>
				<p className="text-muted-foreground text-xs">
					Several open deals matched each call. Pick the correct deal.
				</p>
			</div>
			<div className="flex flex-col divide-y rounded-lg border">
				{review.data.map((activity) => {
					const deals = activity.company?.deals ?? [];
					const dealId = selected[activity.id] ?? "";
					return (
						<div
							className="flex flex-col gap-3 p-4 md:flex-row md:items-center"
							key={activity.id}
						>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
									<p className="font-medium text-sm">
										{activity.subject ?? "Granola customer call"}
									</p>
									{activity.granolaUrl ? (
										<Link
											href={activity.granolaUrl}
											target="_blank"
											className="text-muted-foreground text-xs underline underline-offset-3"
										>
											Open in Granola
										</Link>
									) : null}
								</div>
								<p className="text-muted-foreground text-xs">
									{activity.company?.name ?? "Unknown company"}
									{activity.contact
										? ` · ${[
												activity.contact.firstName,
												activity.contact.lastName,
											]
												.filter(Boolean)
												.join(" ")}`
										: ""}
									{activity.occurredAt ? (
										<>
											{" · "}
											<LocalDateTime
												date={activity.occurredAt}
												options={DATE_OPTIONS}
											/>
										</>
									) : null}
								</p>
							</div>
							<Select
								value={dealId}
								onValueChange={(value) =>
									setSelected((current) => ({
										...current,
										[activity.id]: value,
									}))
								}
								disabled={deals.length === 0 || assign.isPending}
							>
								<SelectTrigger className="w-full md:w-56">
									<SelectValue placeholder="Choose a deal" />
								</SelectTrigger>
								<SelectContent>
									{deals.map((deal) => (
										<SelectItem key={deal.id} value={deal.id}>
											{deal.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								size="sm"
								disabled={!dealId || assign.isPending}
								onClick={() =>
									assign.mutate({ activityId: activity.id, dealId })
								}
							>
								Assign
							</Button>
						</div>
					);
				})}
			</div>
		</section>
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
		<div className="flex min-w-0 flex-col gap-1 bg-card p-4">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span
				className={
					tone === "error"
						? "wrap-anywhere text-destructive text-sm"
						: "wrap-anywhere text-sm"
				}
			>
				{value}
			</span>
		</div>
	);
}
