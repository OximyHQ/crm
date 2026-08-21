import { GTM_PIPELINE } from "./gtm-config";
import { type LinkedInQuery, linkedinQuery } from "./linkedin-clickhouse";

export type ExperienceRow = {
	title: string;
	company_name: string;
	company_id: string | number | null;
	date_from: string;
	date_to: string;
	is_current: number | string;
};

export type ProfileRow = {
	id: string | number;
	full_name: string;
	headline: string;
	profile_url: string;
	city: string;
	state: string;
	country: string;
	connections_count: string | number;
	follower_count: string | number;
	updated_at: string | null;
	experience: ExperienceRow[];
};

export async function hydrateProfiles(
	personIds: string[],
	query: LinkedInQuery = linkedinQuery,
): Promise<Map<string, ProfileRow>> {
	if (personIds.length === 0) return new Map();

	const rows = await query<ProfileRow>(
		`SELECT
			id, full_name,
			COALESCE(headline, '') AS headline,
			profile_url,
			COALESCE(city, '') AS city,
			COALESCE(state, '') AS state,
			COALESCE(country, '') AS country,
			COALESCE(connections_count, 0) AS connections_count,
			COALESCE(follower_count, 0) AS follower_count,
			toString(updated_at) AS updated_at,
			arrayFilter(x -> x.deleted = 0, experience) AS experience
		 FROM profiles
		 WHERE id IN ({hy_ids:Array(Int64)}) AND is_parent = 1 AND deleted = 0
		 LIMIT {hy_limit:UInt32}`,
		{ hy_ids: personIds.map(Number), hy_limit: personIds.length },
		{
			stage: "profile hydration",
			actionableErrors: true,
			maxExecutionSeconds: GTM_PIPELINE.profile.maxExecutionSeconds,
			retryTimeouts: false,
		},
	);

	return new Map(rows.map((row) => [String(row.id), row]));
}
