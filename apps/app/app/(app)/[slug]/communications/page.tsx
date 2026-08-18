import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CallNumberDialog } from "./call-number-dialog";
import { loadCommunicationsSearchParams } from "./communications-search-params.server";
import { CommunicationsWorkspace } from "./communications-workspace";

export const metadata: Metadata = { title: "Communications" };

export default function CommunicationsPage({
	searchParams,
}: PageProps<"/[slug]/communications">) {
	return (
		<PageShell className="min-h-0" contained>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Communications</PageShellTitle>
					<PageShellDescription>
						Calls, messages, recordings, summaries, and transcripts.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CallNumberDialog />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<CommunicationsContent searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function CommunicationsContent({
	searchParams,
}: Pick<PageProps<"/[slug]/communications">, "searchParams">) {
	await requireSession();
	const values = await loadCommunicationsSearchParams(searchParams);
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.communications.list.queryOptions({
			q: values.q,
			filter: values.filter,
			page: values.page,
			pageSize: 50,
		}),
	);
	return (
		<HydrateClient>
			<CommunicationsWorkspace />
		</HydrateClient>
	);
}
