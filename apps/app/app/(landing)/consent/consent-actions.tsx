"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

export function ConsentActions({
	oauthQuery,
	scope,
}: {
	oauthQuery: string;
	scope: string;
}) {
	const [pending, setPending] = useState(false);

	async function respond(accept: boolean) {
		setPending(true);
		const { data, error } = await authClient.oauth2.consent({
			accept,
			oauth_query: oauthQuery || undefined,
			scope: accept ? scope : undefined,
		});

		if (error || !data?.url) {
			setPending(false);
			toast.error(error?.message ?? "Could not complete authorization.");
			return;
		}

		window.location.assign(data.url);
	}

	return (
		<div className="flex gap-3">
			<Button
				disabled={pending}
				onClick={() => respond(false)}
				type="button"
				variant="outline"
			>
				Deny
			</Button>
			<Button disabled={pending} onClick={() => respond(true)} type="button">
				Allow access
			</Button>
		</div>
	);
}
