import { createLoader } from "nuqs/server";
import { communicationsSearchParams } from "./communications-search-params";

export const loadCommunicationsSearchParams = createLoader(
	communicationsSearchParams,
);
