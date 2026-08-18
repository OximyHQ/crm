import { describe, expect, it } from "bun:test";
import { quoWebDialerUrl } from "../lib/quo-web-dialer";

describe("Quo web dialer", () => {
	it("opens the browser dialer with the destination filled", () => {
		const url = new URL(quoWebDialerUrl("+1 415-555-0100"));

		expect(url.origin).toBe("https://my.quo.com");
		expect(url.searchParams.get("handlerUrl")).toBe("tel:+1 415-555-0100");
	});
});
