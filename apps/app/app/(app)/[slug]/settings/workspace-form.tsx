"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceSlug } from "@/lib/use-workspace-url";
import { workspaceUrl } from "@/lib/workspace-url";

export function WorkspaceForm() {
	return (
		<>
			<WorkspaceIdentityForm />
			<WorkspaceProfileForm />
		</>
	);
}

function WorkspaceIdentityForm() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const slug = useWorkspaceSlug();

	const nameId = useId();
	const websiteId = useId();

	const workspace = useQuery(trpc.workspace.get.queryOptions());

	const [draft, setDraft] = useState<{ name: string; website: string } | null>(
		null,
	);

	const save = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: async (saved) => {
				await cache.workspace();
				setDraft(null);
				toast.success("Workspace saved.");

				if (saved.slug !== slug) {
					router.replace(workspaceUrl(saved.slug, "/settings"));
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!workspace.data) return null;

	const { name, website, canRename } = workspace.data;

	const values = draft ?? { name, website: website ?? "" };
	const dirty = values.name !== name || values.website !== (website ?? "");

	const edit = (patch: Partial<typeof values>) =>
		setDraft({ ...values, ...patch });

	return (
		<Card>
			<CardHeader>
				<CardTitle>Workspace</CardTitle>
				<CardDescription>
					The name and website of the company using this CRM.
				</CardDescription>

				<CardAction>
					<Button
						type="submit"
						form="workspace"
						disabled={
							!canRename ||
							save.isPending ||
							!dirty ||
							values.name.trim() === "" ||
							values.website.trim() === ""
						}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="workspace"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							name: values.name,
							website: values.website.trim(),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={values.name}
								onChange={(event) => edit({ name: event.target.value })}
								placeholder="Acme Inc."
								autoComplete="organization"
								disabled={!canRename || save.isPending}
								required
							/>
							<FieldDescription>
								Shown wherever the CRM refers to your own company.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={websiteId}>Website</FieldLabel>
							<InputGroup>
								<InputGroupAddon>
									<InputGroupText>https://</InputGroupText>
								</InputGroupAddon>
								<InputGroupInput
									id={websiteId}
									value={values.website}
									onChange={(event) => edit({ website: event.target.value })}
									placeholder="acme.com"
									autoComplete="off"
									autoCapitalize="off"
									autoCorrect="off"
									spellCheck={false}
									inputMode="url"
									disabled={!canRename || save.isPending}
								/>
							</InputGroup>
							<FieldDescription>Your own company's website.</FieldDescription>
						</Field>
					</FieldGroup>
				</form>

				{canRename ? null : (
					<FieldDescription>
						Only an owner or an admin can change this.
					</FieldDescription>
				)}
			</CardContent>
		</Card>
	);
}

type ProfileDraft = {
	narrative: string;
	sells: string;
	sellsTo: string;
	edge: string;
};

function WorkspaceProfileForm() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const narrativeId = useId();
	const sellsId = useId();
	const sellsToId = useId();
	const edgeId = useId();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const [draft, setDraft] = useState<ProfileDraft | null>(null);

	const save = useMutation(
		trpc.workspace.updateProfile.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				setDraft(null);
				toast.success("Company context saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!workspace.data) return null;

	const { canRename, name, profile } = workspace.data;
	const saved: ProfileDraft = {
		narrative: profile?.narrative ?? "",
		sells: profile?.sells ?? "",
		sellsTo: profile?.sellsTo ?? "",
		edge: profile?.edge ?? "",
	};
	const values = draft ?? saved;
	const dirty =
		values.narrative !== saved.narrative ||
		values.sells !== saved.sells ||
		values.sellsTo !== saved.sellsTo ||
		values.edge !== saved.edge;
	const edit = (patch: Partial<ProfileDraft>) =>
		setDraft({ ...values, ...patch });

	return (
		<Card>
			<CardHeader>
				<CardTitle>Company context</CardTitle>
				<CardDescription>
					CRM agents and connected assistants use this profile to understand
					your company.
				</CardDescription>

				<CardAction>
					<Button
						type="submit"
						form="workspace-profile"
						disabled={
							!canRename ||
							save.isPending ||
							!dirty ||
							values.narrative.trim().length < 40
						}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="workspace-profile"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate(values);
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={narrativeId}>About {name}</FieldLabel>
							<Textarea
								id={narrativeId}
								value={values.narrative}
								onChange={(event) => edit({ narrative: event.target.value })}
								placeholder={`What ${name} does and how it creates value.`}
								disabled={!canRename || save.isPending}
								maxLength={320}
								required
							/>
							<FieldDescription>
								Use two or three factual sentences. Minimum 40 characters.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={sellsId}>We sell</FieldLabel>
							<Input
								id={sellsId}
								value={values.sells}
								onChange={(event) => edit({ sells: event.target.value })}
								placeholder="Products and services"
								disabled={!canRename || save.isPending}
								maxLength={140}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={sellsToId}>We sell to</FieldLabel>
							<Input
								id={sellsToId}
								value={values.sellsTo}
								onChange={(event) => edit({ sellsTo: event.target.value })}
								placeholder="Ideal customers and buyers"
								disabled={!canRename || save.isPending}
								maxLength={140}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={edgeId}>Why customers choose us</FieldLabel>
							<Input
								id={edgeId}
								value={values.edge}
								onChange={(event) => edit({ edge: event.target.value })}
								placeholder="Differentiation from alternatives"
								disabled={!canRename || save.isPending}
								maxLength={140}
							/>
						</Field>
					</FieldGroup>
				</form>

				{canRename ? null : (
					<FieldDescription>
						Only an owner or an admin can change this.
					</FieldDescription>
				)}
			</CardContent>
		</Card>
	);
}
