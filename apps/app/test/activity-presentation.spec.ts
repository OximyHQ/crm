import { describe, expect, it } from "bun:test";
import { ActivityType } from "@crm/db/enums";
import { activityIcon, activityLabel } from "../lib/activity-presentation";

describe("activity presentation", () => {
	it("presents LinkedIn activity", () => {
		expect(activityLabel(ActivityType.LINKEDIN)).toBe("LinkedIn");
		expect(activityIcon(ActivityType.LINKEDIN)).toBeDefined();
	});
});
