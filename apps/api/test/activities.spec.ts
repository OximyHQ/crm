import { describe, expect, it } from "bun:test";
import { ActivityType } from "@crm/db/enums";
import { activityCreateInput } from "../src/activities/activities.contracts";

describe("activityCreateInput", () => {
	it("accepts LinkedIn activity", () => {
		const input = activityCreateInput.parse({
			type: ActivityType.LINKEDIN,
			body: "Sent a connection request.",
			contactId: "contact-1",
		});

		expect(input.type).toBe(ActivityType.LINKEDIN);
	});
});
