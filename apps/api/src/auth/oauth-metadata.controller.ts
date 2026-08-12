import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth, OAUTH_ISSUER } from "@crm/auth";
import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

const metadata = oauthProviderAuthServerMetadata(auth);

@Controller(".well-known")
export class OAuthMetadataController {
	@Get("oauth-authorization-server/api/auth")
	@AllowAnonymous()
	async authorizationServer() {
		const response = await metadata(new Request(OAUTH_ISSUER));
		return response.json();
	}
}
