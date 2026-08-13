import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";
import { GranolaConnection } from "./granola-connection";

export const metadata: Metadata = { title: "Granola" };

export default function GranolaConnectionPage(
	props: PageProps<"/[slug]/settings/connections/granola">,
) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<GranolaConnectionPageContent {...props} />
		</Suspense>
	);
}

async function GranolaConnectionPageContent({
	params,
}: PageProps<"/[slug]/settings/connections/granola">) {
	await requireSession();
	const { slug } = await params;
	const queryClient = getServerQueryClient();
	const status = await queryClient.fetchQuery(
		getServerTrpc().granola.status.queryOptions(),
	);

	return (
		<ConnectionPage centered={!status.connected}>
			<GranolaConnection slug={slug} status={status} />
		</ConnectionPage>
	);
}
