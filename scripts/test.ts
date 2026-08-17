import { spawnSync } from "node:child_process";

if (!process.env.TEST_DATABASE_URL?.trim()) {
	console.log(
		"Skipping the database-backed test suite because TEST_DATABASE_URL is not set.",
	);
	process.exit(0);
}

const result = spawnSync("bun", ["run", "test:database"], {
	stdio: "inherit",
	env: process.env,
});

process.exit(result.status ?? 1);
