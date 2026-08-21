# GTM people timeout reliability

## Goal

Make large people pulls finish faster and fail with an actionable stage name.
Preserve the existing candidate, hierarchy, profile, and verification quality.

## Cause

The roster query has a 60-second budget and no timeout retry. Company resolution
and profile hydration still inherit the shared 30-second budget. Their timeout
retry starts the same query again and discards up to 30 seconds of completed
work. A successful retry can therefore make one stage exceed 60 seconds.

The final task outcome stores only the ClickHouse error. It does not identify
the failed pipeline stage. Sazabi therefore cannot separate company resolution,
roster scanning, and profile hydration failures.

## Design

Use one 60-second timeout attempt for every GTM ClickHouse stage. Keep retries
for transport failures. Do not retry ClickHouse execution timeouts. This gives a
slow query twice the continuous execution time without increasing its existing
60-second worst-case timeout cost.

Add an exact-first company lookup. The fast query uses anchored name probes and
the existing application normalization. Use the current broad substring query
only when the fast query finds no exact match. Never accept a fuzzy result from
the fast query. This preserves the existing fuzzy fallback and improves the
common exact-name path.

Attach a stage name to each query. Log the stage, attempt, duration, row count,
and timeout budget. Do not log SQL, parameters, company names, or profile data.
Wrap terminal errors with the stage name so the task outcome identifies the
failed operation.

Do not increase AI or web concurrency. Higher external concurrency can produce
more rate-limit failures and reduce verification coverage. Accuracy has priority
over that speed improvement.

## Validation

Add behavioral coverage for these cases:

- An exact company match skips the broad lookup.
- A non-exact fast result still uses the broad lookup.
- The broad lookup preserves the existing fuzzy fallback.
- GTM stages use a continuous 60-second budget without timeout retries.
- Terminal query errors include the stage name.

Run the focused agent test suite, type check, and complete diff checks.
