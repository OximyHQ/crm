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

Keep the existing company resolution query and selection rules unchanged. The
same query gets one continuous 60-second attempt instead of two 30-second
attempts. This improves slow exact and fuzzy lookups without changing matches.

Attach a stage name to each query. Log the stage, attempt, duration, row count,
timeout budget, and safe ClickHouse error code. Do not log SQL, parameters,
company names, or profile data. Wrap GTM errors with the stage name and safe
code. Preserve the existing error contract for other LinkedIn discovery tools.

Do not increase AI or web concurrency. Higher external concurrency can produce
more rate-limit failures and reduce verification coverage. Accuracy has priority
over that speed improvement.

## Validation

Add behavioral coverage for these cases:

- Company resolution preserves exact-match preference.
- Company resolution preserves the existing fuzzy fallback.
- GTM stages use a continuous 60-second budget without timeout retries.
- Terminal query errors include the stage name.

Run the focused agent test suite, type check, and complete diff checks.
