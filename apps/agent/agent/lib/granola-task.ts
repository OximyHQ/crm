import { db } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { readGranolaConnection } from "@crm/db/settings";
import { schemas } from "@crm/validation";
import { getGranolaNote, listGranolaNoteIds } from "./granola-client";
import { fileGranolaNote } from "./granola-note";

export async function runGranolaNoteTask(value: unknown): Promise<string> {
	const payload = schemas.granola.noteTaskPayload.parse(value);
	const connection = await readGranolaConnection(db);
	if (!connection) return "Granola is disconnected, so the note was not filed.";

	try {
		const note = await getGranolaNote(connection.apiKey, payload.noteId);
		const result = await fileGranolaNote(note);
		await db.appSetting.updateMany({
			where: { id: "app" },
			data: { granolaLastSyncedAt: new Date(), granolaLastError: null },
		});

		if (result.status === "matched") {
			return `Filed the meeting on deal ${result.dealId}.`;
		}
		if (result.status === "needs_review") {
			return "Filed the meeting without a deal because several open deals match.";
		}
		return "No existing CRM record matched this meeting.";
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await db.appSetting.updateMany({
			where: { id: "app" },
			data: { granolaLastError: message.slice(0, 500) },
		});
		throw error;
	}
}

export async function runGranolaBackfill(): Promise<string> {
	const connection = await readGranolaConnection(db);
	if (!connection) return "Granola is disconnected, so no backfill ran.";

	const noteIds = await listGranolaNoteIds(
		connection.apiKey,
		connection.folderId,
	);
	const pending = await db.agentTask.findMany({
		where: {
			kind: "granola-note",
			finishedAt: null,
			subject: { in: noteIds },
		},
		select: { subject: true },
	});
	const taken = new Set(
		pending.flatMap((task) => (task.subject ? [task.subject] : [])),
	);
	const fresh = noteIds.filter((noteId) => !taken.has(noteId));

	if (fresh.length > 0) {
		await db.agentTask.createMany({
			data: fresh.map((noteId) => ({
				kind: "granola-note",
				subject: noteId,
				reason: `Backfill Granola note ${noteId}`,
				payload: {
					noteId,
					eventId: `backfill:${noteId}`,
					eventType: "backfill",
				},
				priority: PRIORITY.granolaNote,
				budget: 1,
				dueAt: new Date(),
			})),
		});
	}

	return `Queued ${fresh.length} Granola notes; ${noteIds.length - fresh.length} were already waiting.`;
}
