import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";
import { QuoConnection } from "./quo-connection";

export const metadata: Metadata = { title: "Quo" };

export default function QuoConnectionPage(
	props: PageProps<"/[slug]/settings/connections/quo">,
) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<QuoConnectionPageContent {...props} />
		</Suspense>
	);
}

async function QuoConnectionPageContent({
	params,
}: PageProps<"/[slug]/settings/connections/quo">) {
	await requireSession();
	const { slug } = await params;
	const queryClient = getServerQueryClient();
	const status = await queryClient.fetchQuery(
		getServerTrpc().quo.status.queryOptions(),
	);

	return (
		<ConnectionPage centered={!status.connected}>
			<QuoConnection slug={slug} status={status} />
		</ConnectionPage>
	);
}
