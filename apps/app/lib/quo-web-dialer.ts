const QUO_WEB_APP_URL = "https://my.quo.com/";

export function quoWebDialerUrl(phoneNumber: string): string {
	const url = new URL(QUO_WEB_APP_URL);
	url.searchParams.set("handlerUrl", `tel:${phoneNumber}`);
	return url.toString();
}
