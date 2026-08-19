"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowUpRight from "@carbon/icons-react/es/ArrowUpRight";
import LogoLinkedin from "@carbon/icons-react/es/LogoLinkedin";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { Spinner } from "@crm/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { LocalDay } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import { useOpenRecord } from "./record-stack";

export function PersonProfileDialog({
	personRowId,
	onClose,
	onAdd,
	adding,
}: {
	personRowId: string | null;
	onClose: () => void;
	onAdd: (id: string) => void;
	adding: boolean;
}) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();

	const query = useQuery({
		...trpc.people.byId.queryOptions({ id: personRowId ?? "" }),
		enabled: personRowId !== null,
	});

	const person = query.data;
	const location = person
		? [person.city, person.country].filter(Boolean).join(", ")
		: null;

	return (
		<Dialog
			open={personRowId !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
				{!person ? (
					<div className="flex justify-center py-10">
						<Spinner />
					</div>
				) : (
					<>
						<DialogHeader>
							<div className="flex items-center gap-3">
								<PersonAvatar src={null} name={person.fullName} size="lg" />
								<div className="min-w-0">
									<DialogTitle className="truncate">
										{person.fullName}
									</DialogTitle>
									<DialogDescription className="truncate">
										{person.title}
										{location ? ` · ${location}` : ""}
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>

						{person.profile?.headline ? (
							<p className="text-sm text-muted-foreground">
								{person.profile.headline}
							</p>
						) : null}

						<div className="flex flex-wrap items-center gap-2">
							{person.status === "ADDED" ? (
								<Badge variant="outline">In CRM</Badge>
							) : null}
							{person.profileAsOf ? (
								<span className="text-xs text-muted-foreground">
									Profile as of <LocalDay date={person.profileAsOf} />
								</span>
							) : null}
							<span className="flex-1" />
							{person.linkedinUrl ? (
								<Button variant="outline" size="sm" asChild>
									<a
										href={person.linkedinUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Icon icon={LogoLinkedin} data-icon="inline-start" />
										LinkedIn
									</a>
								</Button>
							) : null}
							{person.status === "SUGGESTED" ? (
								<Button
									size="sm"
									disabled={adding}
									onClick={() => onAdd(person.id)}
								>
									<Icon icon={Add} data-icon="inline-start" />
									Add as contact
								</Button>
							) : null}
							{person.contactId ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										onClose();
										openRecord({
											kind: "contact",
											id: person.contactId as string,
										});
									}}
								>
									<Icon icon={ArrowUpRight} data-icon="inline-start" />
									Open contact
								</Button>
							) : null}
						</div>

						{person.profile && person.profile.experiences.length > 0 ? (
							<div>
								<h3 className="mb-2 text-sm font-medium">Experience</h3>
								<ul className="space-y-3">
									{person.profile.experiences.map((experience) => (
										<li
											key={`${experience.company}|${experience.title}|${experience.from ?? ""}`}
											className="text-sm"
										>
											<div className="font-medium">{experience.title}</div>
											<div className="text-muted-foreground">
												{experience.company}
												{experience.from
													? ` · ${experience.from} – ${
															experience.current
																? "Present"
																: (experience.to ?? "")
														}`
													: ""}
											</div>
										</li>
									))}
								</ul>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No experience history was captured for this profile.
							</p>
						)}
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
