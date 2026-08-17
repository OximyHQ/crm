import { parse, schemas } from "@crm/validation";
import { joinSlackChannel } from "./slack-membership";

export async function runSlackChannelJoin(value: unknown): Promise<string> {
	const { channelId, channelName } = parse(
		schemas.slack.joinPayload,
		value,
		"A slack-channel-join task carries an unreadable payload",
	);
	const outcome = await joinSlackChannel(channelId);

	if (outcome.joined) {
		return outcome.already
			? `Oximy was already in #${channelName}.`
			: `Oximy joined #${channelName}.`;
	}

	return `Oximy could not join #${channelName}. ${outcome.reason}`;
}
