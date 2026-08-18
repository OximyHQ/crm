import { schemas } from "@crm/validation";
import { z } from "zod";

export const quoConnectInput = schemas.quo.connectPayload.omit({
	webhookUrl: true,
});

export type QuoConnectInput = z.infer<typeof quoConnectInput>;
