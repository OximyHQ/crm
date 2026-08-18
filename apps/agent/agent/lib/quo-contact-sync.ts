import { db, type Prisma } from "@crm/db";
import { normalizePhone } from "@crm/db/phones";
import { readQuoConnection } from "@crm/db/settings";
import { schemas } from "@crm/validation";
import {
	createQuoContact,
	listQuoContacts,
	updateQuoContact,
} from "./quo-client";
import { QUO } from "./quo-config";

type QuoContact = ReturnType<typeof schemas.quo.contactSnapshot.parse>;

const CRM_CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
	title: true,
	company: { select: { name: true } },
	phones: {
		orderBy: { primary: "desc" as const },
		select: { value: true, e164: true, label: true },
	},
} as const;

type CrmContact = Prisma.ContactGetPayload<{
	select: typeof CRM_CONTACT_SELECT;
}>;

export async function runQuoSyncTask(): Promise<string> {
	const connection = await readQuoConnection(db);
	if (!connection) return "Quo is disconnected, so contacts were not synced.";

	const remote = await listQuoContacts(connection.apiKey);
	const imported = await importQuoPhones(remote);
	const contacts = await db.contact.findMany({
		where: { OR: [{ phone: { not: null } }, { phones: { some: {} } }] },
		select: CRM_CONTACT_SELECT,
	});
	let pushed = 0;
	for (const contact of contacts) {
		const external = remote.find((item) => item.externalId === contact.id);
		const emailMatch = contact.email
			? remote.find((item) =>
					item.defaultFields.emails.some(
						(email) =>
							email.value.toLowerCase() === contact.email?.toLowerCase(),
					),
				)
			: undefined;
		await writeQuoContact(connection.apiKey, contact, external ?? emailMatch);
		pushed += 1;
	}
	return `Synced ${pushed} CRM contacts and imported ${imported} Quo phone numbers.`;
}

export async function runQuoContactSyncTask(value: unknown): Promise<string> {
	const { contactId } = schemas.quo.contactSyncTaskPayload.parse(value);
	const connection = await readQuoConnection(db);
	if (!connection) return "Quo is disconnected, so the contact was not synced.";
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: CRM_CONTACT_SELECT,
	});
	if (!contact)
		return "The contact was removed before Quo contact sync started.";
	let remote = (
		await listQuoContacts(connection.apiKey, { externalIds: [contact.id] })
	)[0];
	if (!remote && contact.email) {
		remote = (await listQuoContacts(connection.apiKey)).find((item) =>
			item.defaultFields.emails.some(
				(email) => email.value.toLowerCase() === contact.email?.toLowerCase(),
			),
		);
	}
	await writeQuoContact(connection.apiKey, contact, remote);
	return `Synced contact ${contact.id} to Quo.`;
}

async function importQuoPhones(remote: QuoContact[]): Promise<number> {
	let imported = 0;
	for (const quoContact of remote) {
		const emails = quoContact.defaultFields.emails.map((item) => item.value);
		if (emails.length === 0) continue;
		const matches = await db.contact.findMany({
			where: { email: { in: emails, mode: "insensitive" } },
			select: { id: true, phone: true },
		});
		const match = matches[0];
		if (matches.length !== 1 || !match) continue;
		for (const phone of quoContact.defaultFields.phoneNumbers) {
			const e164 = normalizePhone(phone.value);
			if (!e164) continue;
			await db.$transaction(async (tx) => {
				await tx.contactPhone.upsert({
					where: {
						contactId_e164: { contactId: match.id, e164 },
					},
					create: {
						contactId: match.id,
						value: phone.value,
						e164,
						label: phone.name,
						providerContactId: quoContact.id,
						source: "QUO",
						primary: !match.phone,
					},
					update: {
						providerContactId: quoContact.id,
						label: phone.name,
					},
				});
				if (!match.phone) {
					await tx.contact.update({
						where: { id: match.id },
						data: { phone: phone.value },
					});
				}
			});
			imported += 1;
		}
	}
	return imported;
}

async function writeQuoContact(
	apiKey: string,
	contact: CrmContact,
	remote?: QuoContact,
) {
	const values = contact.phones.length
		? contact.phones
		: contact.phone && normalizePhone(contact.phone)
			? [
					{
						value: contact.phone,
						e164: normalizePhone(contact.phone) as string,
						label: null,
					},
				]
			: [];
	if (values.length === 0) return;
	const payload = {
		externalId: contact.id,
		source: QUO.contacts.source,
		defaultFields: {
			firstName: contact.firstName,
			lastName: contact.lastName,
			company: contact.company?.name ?? null,
			role: contact.title,
			emails: contact.email
				? [
						{
							name: QUO.contacts.label,
							value: contact.email,
							...fieldId(remote?.defaultFields.emails, contact.email),
						},
					]
				: [],
			phoneNumbers: values.map((phone) => ({
				name: phone.label ?? QUO.contacts.label,
				value: phone.e164,
				...fieldId(remote?.defaultFields.phoneNumbers, phone.e164),
			})),
		},
	};
	if (remote) return updateQuoContact(apiKey, remote.id, payload);
	return createQuoContact(apiKey, payload);
}

function fieldId(
	fields: { id?: string; value: string }[] | undefined,
	value: string,
) {
	const id = fields?.find(
		(field) => field.value.toLowerCase() === value.toLowerCase(),
	)?.id;
	return id ? { id } : {};
}
