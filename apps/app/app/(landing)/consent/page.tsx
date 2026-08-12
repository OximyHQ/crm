import { auth } from "@crm/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { describeOAuthScopes } from "@/lib/oauth-consent";
import { ConsentActions } from "./consent-actions";

export const metadata: Metadata = { title: "Authorize CRM access" };
export const instant = false;

export default async function ConsentPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const query = await searchParams;
	const clientId = typeof query.client_id === "string" ? query.client_id : null;
	const scope = typeof query.scope === "string" ? query.scope : "";
	const oauthQuery =
		typeof query.oauth_query === "string" ? query.oauth_query : "";

	if (!clientId) redirect("/");

	const client = await auth.api.getOAuthClientPublic({
		headers: await headers(),
		query: { client_id: clientId },
	});
	const permissions = describeOAuthScopes(scope);

	return (
		<AuthShell>
			<AuthHeading
				title="Connect to your CRM"
				description={`${client.name ?? "This application"} requests access to your internal CRM.`}
			/>
			<ul className="flex flex-col gap-3 text-sm/5">
				{permissions.map((permission) => (
					<li key={permission}>{permission}</li>
				))}
			</ul>
			<ConsentActions oauthQuery={oauthQuery} scope={scope} />
		</AuthShell>
	);
}
