"use client";

import Chat from "@carbon/icons-react/es/Chat";
import Phone from "@carbon/icons-react/es/Phone";
import Search from "@carbon/icons-react/es/Search";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useDeferredValue, useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CommunicationDetail } from "./communication-detail";
import {
	COMMUNICATION_FILTERS,
	communicationsSearchParams,
} from "./communications-search-params";

type Communication = RouterOutputs["communications"]["list"]["rows"][number];

const FILTER_LABELS: Record<(typeof COMMUNICATION_FILTERS)[number], string> = {
	all: "All",
	calls: "Calls",
	messages: "Messages",
	review: "Needs review",
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

export function CommunicationsWorkspace() {
	const trpc = useTRPC();
	const [query, setQuery] = useQueryStates(communicationsSearchParams);
	const deferredQ = useDeferredValue(query.q);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const communications = useQuery({
		...trpc.communications.list.queryOptions({
			q: deferredQ,
			filter: query.filter,
			page: query.page,
			pageSize: 50,
		}),
		placeholderData: (previous) => previous,
	});
	const rows = communications.data?.rows ?? [];
	const selected = rows.some((row) => row.id === selectedId)
		? selectedId
		: (rows[0]?.id ?? null);

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
			<div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center">
				<Tabs
					value={query.filter}
					onValueChange={(filter) =>
						isCommunicationFilter(filter)
							? void setQuery({ filter, page: 1 })
							: undefined
					}
				>
					<TabsList>
						{COMMUNICATION_FILTERS.map((filter) => (
							<TabsTrigger value={filter} key={filter}>
								{FILTER_LABELS[filter]}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<InputGroup className="sm:ml-auto sm:max-w-sm">
					<InputGroupAddon>
						<Icon icon={Search} />
					</InputGroupAddon>
					<InputGroupInput
						value={query.q}
						onChange={(event) =>
							void setQuery({ q: event.target.value, page: 1 })
						}
						placeholder="Search names, numbers, or transcripts…"
						aria-label="Search communications"
					/>
				</InputGroup>
			</div>

			<div className="grid min-h-0 flex-1 md:grid-cols-[minmax(18rem,0.9fr)_minmax(24rem,1.4fr)]">
				<div className="min-h-0 overflow-y-auto border-b md:border-r md:border-b-0">
					{communications.isLoading ? (
						<div className="flex justify-center py-16">
							<Spinner />
						</div>
					) : rows.length === 0 ? (
						<Empty className="border-0">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Icon icon={Phone} />
								</EmptyMedia>
								<EmptyTitle>No communications</EmptyTitle>
								<EmptyDescription>
									Completed Quo calls and messages appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<ul className="divide-y">
							{rows.map((communication) => (
								<CommunicationRow
									communication={communication}
									selected={communication.id === selected}
									onSelect={() => setSelectedId(communication.id)}
									key={communication.id}
								/>
							))}
						</ul>
					)}
				</div>
				<div className="min-h-0 overflow-y-auto">
					{selected ? (
						<CommunicationDetail id={selected} />
					) : (
						<Empty className="h-full border-0">
							<EmptyHeader>
								<EmptyTitle>Select a communication</EmptyTitle>
								<EmptyDescription>
									Details, recordings, and transcripts appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</div>
			</div>
		</div>
	);
}

function isCommunicationFilter(
	value: string,
): value is (typeof COMMUNICATION_FILTERS)[number] {
	return COMMUNICATION_FILTERS.some((filter) => filter === value);
}

function CommunicationRow({
	communication,
	selected,
	onSelect,
}: {
	communication: Communication;
	selected: boolean;
	onSelect: () => void;
}) {
	const external = communication.participants[0];
	const contact = external?.contact;
	const title = contact
		? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
		: (external?.phoneE164 ?? "Unknown number");
	const preview =
		communication.summary ?? communication.body ?? communication.status;

	return (
		<li>
			<Button
				variant="ghost"
				className={cn(
					"h-auto w-full justify-start rounded-none px-4 py-3 text-left",
					selected && "bg-muted",
				)}
				onClick={onSelect}
			>
				<span className="mt-0.5 text-muted-foreground">
					<Icon icon={communication.kind === "CALL" ? Phone : Chat} />
				</span>
				<span className="min-w-0 flex-1 space-y-1">
					<span className="flex items-center gap-2">
						<span className="truncate font-medium">{title}</span>
						{communication.matchStatus === "NEEDS_REVIEW" ? (
							<Badge variant="outline">Review</Badge>
						) : null}
					</span>
					{preview ? (
						<span className="block truncate text-muted-foreground">
							{preview}
						</span>
					) : null}
					<span className="flex items-center gap-2 text-muted-foreground">
						<span className="capitalize">
							{communication.direction?.toLowerCase() ?? "Unknown direction"}
						</span>
						<span>·</span>
						<LocalDateTime
							date={communication.occurredAt}
							options={DATE_OPTIONS}
						/>
					</span>
				</span>
			</Button>
		</li>
	);
}
