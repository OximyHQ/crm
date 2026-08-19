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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DetailSheetEmpty } from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { ENRICHMENT_POLL_MS } from "@/lib/enrichment-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CompanyOrgChart } from "./company-org-chart";
import { useOpenRecord } from "./record-stack";

export type Prospect = RouterOutputs["prospects"]["list"][number];

const ALL = "all";

const TIER_OPTIONS = [
	{ value: ALL, label: "All tiers" },
	{ value: "1", label: "Tier 1" },
	{ value: "2", label: "Tier 2" },
];

const FUNCTION_OPTIONS = [
	"Executive",
	"Engineering",
	"IT",
	"Security",
	"Data & AI",
	"Other",
];

const PEOPLE_COLUMNS = [
	{ id: "name", header: "Name", width: "w-[24%]", className: "pl-5" },
	{ id: "title", header: "Title", width: "w-[26%]" },
	{ id: "tier", header: "Tier", width: "w-[8%]" },
	{ id: "function", header: "Function", width: "w-[12%]" },
	{ id: "location", header: "Location", width: "w-[12%]" },
	{ id: "asof", header: "As of", width: "w-[9%]" },
	{ id: "actions", srLabel: "Actions", width: "w-[9%]" },
];

function locationOf(prospect: Prospect): string | null {
	const parts = [prospect.city, prospect.country].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : null;
}

export function CompanyPeople({
	companyId,
	companyName,
	running,
}: {
	companyId: string;
	companyName: string;
	running: boolean;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();

	const query = useQuery({
		...trpc.prospects.list.queryOptions({ companyId }),
		refetchInterval: running ? ENRICHMENT_POLL_MS : false,
	});

	const [view, setView] = useState<"table" | "chart">("table");
	const [q, setQ] = useState("");
	const [tier, setTier] = useState(ALL);
	const [orgFunction, setOrgFunction] = useState(ALL);
	const [showDismissed, setShowDismissed] = useState(false);

	const rows = useMemo(() => query.data ?? [], [query.data]);
	const dismissedCount = rows.filter(
		(row) => row.status === "DISMISSED",
	).length;

	const visible = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return rows.filter((row) => {
			if (!showDismissed && row.status === "DISMISSED") return false;
			if (tier !== ALL && String(row.tier) !== tier) return false;
			if (orgFunction !== ALL && row.orgFunction !== orgFunction) return false;
			if (
				needle &&
				!row.fullName.toLowerCase().includes(needle) &&
				!row.title.toLowerCase().includes(needle)
			) {
				return false;
			}
			return true;
		});
	}, [rows, q, tier, orgFunction, showDismissed]);

	const invalidate = () => cache.prospects(companyId);

	const add = useMutation(
		trpc.prospects.addAsContact.mutationOptions({
			onSuccess: () => {
				toast.success("Added to contacts.");
				void invalidate();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const dismiss = useMutation(
		trpc.prospects.dismiss.mutationOptions({
			onSuccess: () => void invalidate(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const restore = useMutation(
		trpc.prospects.restore.mutationOptions({
			onSuccess: () => void invalidate(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const refresh = useMutation(
		trpc.prospects.refresh.mutationOptions({
			onSuccess: () => {
				toast.success("Queued. People will refresh shortly.");
				void cache.company(companyId);
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

	if (rows.length === 0) {
		if (running) {
			return (
				<DetailSheetEmpty
					icon={UserMultiple}
					title="Finding people"
					description={`Pulling ${companyName}'s leadership from the LinkedIn snapshot. This usually takes under a minute.`}
					action={<Spinner />}
				/>
			);
		}
		return (
			<DetailSheetEmpty
				icon={UserMultiple}
				title="No people pulled yet"
				description={`Leadership and departmental heads at ${companyName}, from a static LinkedIn snapshot. Suggestions stay here until you add them as contacts.`}
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={() => refresh.mutate({ companyId })}
						disabled={refresh.isPending}
					>
						<Icon icon={Renew} data-icon="inline-start" />
						Find people
					</Button>
				}
			/>
		);
	}

	return (
		<div>
			<div className="flex flex-wrap items-center gap-2 px-5 py-3">
				<Input
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder="Search name or title"
					className="max-w-52"
				/>
				<Select value={tier} onValueChange={setTier}>
					<SelectTrigger className="w-28">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{TIER_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => refresh.mutate({ companyId })}
							disabled={refresh.isPending || running}
						>
							<Icon icon={Renew} data-icon="inline-start" />
							Refresh
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						Re-pull this company's people from the LinkedIn snapshot
					</TooltipContent>
				</Tooltip>
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

			{view === "chart" ? (
				<CompanyOrgChart
					companyName={companyName}
					people={visible.filter((row) => row.status !== "DISMISSED")}
					onAdd={(id) => add.mutate({ id })}
					adding={add.isPending}
				/>
			) : (
				<SimpleTable variant="panel" columns={PEOPLE_COLUMNS}>
					{visible.map((prospect) => (
						<SimpleTableRow
							key={prospect.id}
							clickable={prospect.contactId !== null}
							onClick={() => {
								if (prospect.contactId) {
									openRecord({ kind: "contact", id: prospect.contactId });
								}
							}}
						>
							<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
								<span className="flex min-w-0 items-center gap-2">
									<PersonAvatar src={null} name={prospect.fullName} size="sm" />
									<span
										className={
											prospect.status === "DISMISSED"
												? "truncate text-muted-foreground line-through"
												: "truncate"
										}
									>
										{prospect.fullName}
									</span>
									{prospect.status === "ADDED" ? (
										<Badge variant="outline">In CRM</Badge>
									) : null}
								</span>
							</TableCell>
							<TableCell className="truncate px-3 py-2.5">
								{prospect.title}
							</TableCell>
							<TableCell className="px-3 py-2.5">
								<Badge variant="outline">Tier {prospect.tier}</Badge>
							</TableCell>
							<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
								{prospect.orgFunction}
							</TableCell>
							<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
								{locationOf(prospect) ?? <EmptyCellValue />}
							</TableCell>
							<TableCell className="px-3 py-2.5 text-muted-foreground">
								{prospect.profileAsOf ? (
									<LocalDay date={prospect.profileAsOf} />
								) : (
									<EmptyCellValue />
								)}
							</TableCell>
							<TableCell className="px-3 py-2.5">
								<span className="flex items-center justify-end gap-1">
									{prospect.linkedinUrl ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="icon-xs" asChild>
													<a
														href={prospect.linkedinUrl}
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
									{prospect.status === "SUGGESTED" ? (
										<>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="icon-xs"
														disabled={add.isPending}
														onClick={(event) => {
															event.stopPropagation();
															add.mutate({ id: prospect.id });
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
															dismiss.mutate({ id: prospect.id });
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
									{prospect.status === "DISMISSED" ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon-xs"
													disabled={restore.isPending}
													onClick={(event) => {
														event.stopPropagation();
														restore.mutate({ id: prospect.id });
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
			)}
		</div>
	);
}
