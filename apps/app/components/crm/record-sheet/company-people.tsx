"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import LogoLinkedin from "@carbon/icons-react/es/LogoLinkedin";
import Renew from "@carbon/icons-react/es/Renew";
import Reset from "@carbon/icons-react/es/Reset";
import Table from "@carbon/icons-react/es/Table";
import TreeViewAlt from "@carbon/icons-react/es/TreeViewAlt";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { TableCell } from "@crm/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { GTM_FUNCTIONS } from "@crm/validation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DetailSheetEmpty } from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { ENRICHMENT_POLL_MS } from "@/lib/enrichment-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CompanyOrgChart } from "./company-org-chart";
import { PersonProfileDialog } from "./person-profile-dialog";
import { QuickAddContact } from "./quick-add";

export type CompanyPersonRow = RouterOutputs["people"]["list"][number];

const ALL = "all";

const FUNCTION_OPTIONS = GTM_FUNCTIONS;

const PEOPLE_COLUMNS = [
	{ id: "name", header: "Name", width: "w-[26%]", className: "pl-5" },
	{ id: "title", header: "Title", width: "w-[30%]" },
	{ id: "function", header: "Function", width: "w-[13%]" },
	{ id: "location", header: "Location", width: "w-[13%]" },
	{ id: "asof", header: "As of", width: "w-[9%]" },
	{ id: "actions", srLabel: "Actions", width: "w-[9%]" },
];

function locationOf(person: CompanyPersonRow): string | null {
	const parts = [person.city, person.country].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : null;
}

export function CompanyPeople({
	companyId,
	companyName,
	ownerId,
}: {
	companyId: string;
	companyName: string;
	ownerId: string | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const statusQuery = useQuery({
		...trpc.people.status.queryOptions({ companyId }),
		refetchInterval: (current) =>
			current.state.data?.running ? ENRICHMENT_POLL_MS : false,
	});
	const running = statusQuery.data?.running === true;
	const phase = statusQuery.data?.phase ?? null;
	const lastOutcome = statusQuery.data?.lastOutcome ?? null;

	const query = useQuery({
		...trpc.people.list.queryOptions({ companyId }),
		refetchInterval: running ? ENRICHMENT_POLL_MS : false,
	});

	const wasRunning = useRef(false);
	useEffect(() => {
		if (wasRunning.current && !running) {
			void cache.people(companyId);
		}
		wasRunning.current = running;
	}, [running, companyId, cache]);

	const [view, setView] = useState<"table" | "chart">("table");
	const [q, setQ] = useState("");
	const [orgFunction, setOrgFunction] = useState(ALL);
	const [country, setCountry] = useState(ALL);
	const [showDismissed, setShowDismissed] = useState(false);
	const [openId, setOpenId] = useState<string | null>(null);
	const [addingManually, setAddingManually] = useState(false);

	const rows = useMemo(() => query.data ?? [], [query.data]);
	const dismissedCount = rows.filter(
		(row) => row.status === "DISMISSED",
	).length;

	const countries = useMemo(
		() =>
			[
				...new Set(rows.map((row) => row.country).filter(Boolean)),
			].sort() as string[],
		[rows],
	);

	const visible = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return rows.filter((row) => {
			if (!showDismissed && row.status === "DISMISSED") return false;
			if (orgFunction !== ALL && row.orgFunction !== orgFunction) return false;
			if (country !== ALL && row.country !== country) return false;
			if (
				needle &&
				!row.fullName.toLowerCase().includes(needle) &&
				!row.title.toLowerCase().includes(needle)
			) {
				return false;
			}
			return true;
		});
	}, [rows, q, orgFunction, country, showDismissed]);

	const invalidate = () => cache.people(companyId);

	const add = useMutation(
		trpc.people.addAsContact.mutationOptions({
			onSuccess: () => {
				toast.success("Added to contacts.");
				void invalidate();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const dismiss = useMutation(
		trpc.people.dismiss.mutationOptions({
			onSuccess: () => void invalidate(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const restore = useMutation(
		trpc.people.restore.mutationOptions({
			onSuccess: () => void invalidate(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const refresh = useMutation(
		trpc.people.refresh.mutationOptions({
			onSuccess: () => {
				toast.success("Queued. People will refresh shortly.");
				void cache.people(companyId);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (query.isPending) {
		return (
			<div className="flex justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const manualForm = addingManually ? (
		<QuickAddContact
			companyId={companyId}
			ownerId={ownerId}
			onDone={() => setAddingManually(false)}
		/>
	) : null;

	if (rows.length === 0) {
		if (running) {
			return (
				<DetailSheetEmpty
					icon={UserMultiple}
					title="Finding people"
					description={
						phase ??
						`Pulling ${companyName}'s leadership from the LinkedIn snapshot. This usually takes a minute or two.`
					}
					action={<Spinner />}
				/>
			);
		}
		return (
			<>
				{manualForm}
				{addingManually ? null : (
					<DetailSheetEmpty
						icon={UserMultiple}
						title="No people pulled yet"
						description={
							lastOutcome ??
							`Leadership and departmental heads at ${companyName}, from a LinkedIn snapshot. Suggestions stay here until you add them as contacts.`
						}
						action={
							<span className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => refresh.mutate({ companyId })}
									disabled={refresh.isPending}
								>
									<Icon icon={Renew} data-icon="inline-start" />
									Find people
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setAddingManually(true)}
								>
									<Icon icon={Add} data-icon="inline-start" />
									Add manually
								</Button>
							</span>
						}
					/>
				)}
			</>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<PersonProfileDialog
				personRowId={openId}
				onClose={() => setOpenId(null)}
				onAdd={(id) => add.mutate({ id })}
				adding={add.isPending}
			/>

			<div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-3">
				<Input
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder="Search name or title"
					className="max-w-48"
				/>
				<Select value={orgFunction} onValueChange={setOrgFunction}>
					<SelectTrigger className="w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>All functions</SelectItem>
						{FUNCTION_OPTIONS.map((option) => (
							<SelectItem key={option} value={option}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{countries.length > 1 ? (
					<Select value={country} onValueChange={setCountry}>
						<SelectTrigger className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>All countries</SelectItem>
							{countries.map((option) => (
								<SelectItem key={option} value={option}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				{dismissedCount > 0 ? (
					<Button
						variant="ghost"
						size="sm"
						aria-pressed={showDismissed}
						onClick={() => setShowDismissed((current) => !current)}
					>
						{showDismissed ? "Hide" : "Show"} dismissed ({dismissedCount})
					</Button>
				) : null}
				<span className="flex-1" />
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setAddingManually(true)}
				>
					<Icon icon={Add} data-icon="inline-start" />
					Add manually
				</Button>
				{running ? (
					<span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
						<Spinner />
						<span className="truncate">{phase ?? "Updating"}</span>
					</span>
				) : (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => refresh.mutate({ companyId })}
								disabled={refresh.isPending}
							>
								<Icon icon={Renew} data-icon="inline-start" />
								Refresh
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							Re-pull this company's people from the LinkedIn snapshot
						</TooltipContent>
					</Tooltip>
				)}
				<ToggleGroup
					type="single"
					value={view}
					onValueChange={(next) => {
						if (next) setView(next as "table" | "chart");
					}}
					size="sm"
					spacing={0}
				>
					<ToggleGroupItem value="table" aria-label="Table view">
						<Icon icon={Table} />
					</ToggleGroupItem>
					<ToggleGroupItem value="chart" aria-label="Org chart view">
						<Icon icon={TreeViewAlt} />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{!running && lastOutcome ? (
				<p className="px-5 pb-2 text-muted-foreground text-xs">{lastOutcome}</p>
			) : null}

			{view === "chart" ? (
				<div className="min-h-0 flex-1">
					{manualForm}
					<CompanyOrgChart
						companyName={companyName}
						people={visible.filter((row) => row.status !== "DISMISSED")}
						onOpen={setOpenId}
					/>
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-y-auto">
					{manualForm}
					<SimpleTable variant="panel" columns={PEOPLE_COLUMNS}>
						{visible.map((person) => (
							<SimpleTableRow
								key={person.id}
								clickable
								onClick={() => setOpenId(person.id)}
							>
								<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
									<span className="flex min-w-0 items-center gap-2">
										<PersonAvatar src={null} name={person.fullName} size="sm" />
										<span
											className={
												person.status === "DISMISSED"
													? "truncate text-muted-foreground line-through"
													: "truncate"
											}
										>
											{person.fullName}
										</span>
										{person.status === "ADDED" ? (
											<Badge variant="outline">In CRM</Badge>
										) : null}
									</span>
								</TableCell>
								<TableCell className="truncate px-3 py-2.5">
									{person.title}
								</TableCell>
								<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
									{person.orgFunction}
								</TableCell>
								<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
									{locationOf(person) ?? <EmptyCellValue />}
								</TableCell>
								<TableCell className="px-3 py-2.5 text-muted-foreground">
									{person.profileAsOf ? (
										<LocalDay date={person.profileAsOf} />
									) : (
										<EmptyCellValue />
									)}
								</TableCell>
								<TableCell className="px-3 py-2.5">
									<span className="flex items-center justify-end gap-1">
										{person.linkedinUrl ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button variant="ghost" size="icon-xs" asChild>
														<a
															href={person.linkedinUrl}
															target="_blank"
															rel="noopener noreferrer"
															onClick={(event) => event.stopPropagation()}
														>
															<Icon icon={LogoLinkedin} />
															<span className="sr-only">Open LinkedIn</span>
														</a>
													</Button>
												</TooltipTrigger>
												<TooltipContent>Open LinkedIn</TooltipContent>
											</Tooltip>
										) : null}
										{person.status === "SUGGESTED" ? (
											<>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon-xs"
															disabled={add.isPending}
															onClick={(event) => {
																event.stopPropagation();
																add.mutate({ id: person.id });
															}}
														>
															<Icon icon={Add} />
															<span className="sr-only">Add as contact</span>
														</Button>
													</TooltipTrigger>
													<TooltipContent>Add as contact</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon-xs"
															disabled={dismiss.isPending}
															onClick={(event) => {
																event.stopPropagation();
																dismiss.mutate({ id: person.id });
															}}
														>
															<Icon icon={Close} />
															<span className="sr-only">Dismiss</span>
														</Button>
													</TooltipTrigger>
													<TooltipContent>Dismiss</TooltipContent>
												</Tooltip>
											</>
										) : null}
										{person.status === "DISMISSED" ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="icon-xs"
														disabled={restore.isPending}
														onClick={(event) => {
															event.stopPropagation();
															restore.mutate({ id: person.id });
														}}
													>
														<Icon icon={Reset} />
														<span className="sr-only">Restore</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent>Restore</TooltipContent>
											</Tooltip>
										) : null}
									</span>
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				</div>
			)}
		</div>
	);
}
