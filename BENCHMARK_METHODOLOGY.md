# OpenCode free-model benchmark

Benchmark ID: `opencode-free-2026-10-26` (v1.0)
Provider catalog snapshot: 26 October 2026. The live OpenCode provider listed 23 entries marked free; one is the OpenRouter Free Models Router, an aggregate route rather than a fixed underlying model.

## Run design

Each catalog entry received one independent delegated run. No help or steering was sent while an agent worked. Each run contained the same three test areas:

1. **Implementation and edge cases:** Implement and run a dependency-free JavaScript order summarizer. It had to validate rows and tax rate, preserve first-seen SKU order, use integer cents, reject safe-integer overflow, and test empty/invalid/duplicate/zero-price/half-cent/bad-rate/wrong-input/overflow cases. Agents also identified one frontend, backend, and database concern.
2. **Reasoning and instruction retention:** Return exactly five numbered lines. Required a fixed answer token, a discount-plus-tax calculation, an HTTPS trust explanation, a two-step flaky-bug plan, and an exact long-context marker.
3. **Security review and tool use:** Review an Express export route that trusts request-body identity, interpolates values in SQL, and uses a database path for file download. Identify authorization, SQL injection, path containment, and error-handling risks with fixes; distinguish observed facts from assumptions; run a read-only Git status command.

The first 20 agents received the long-form prompt. The final three received a shorter wording of the same test requirements. Core fixtures, expected results, and scoring criteria were unchanged. Each model had one run, so these results do not establish repeatability.

## Scoring

All requested dimensions are scored 0–5. Higher is better; **Hallucination Rate** is inverted, so 5 means no observed hallucination and 0 means a material error. Evidence phrases are shown beside every score. The overall score is the unweighted mean of the 16 dimensions. Provider failures and incomplete reports are displayed separately from completed model results.

Provider-reported input/output token counts were unavailable. **Token Efficiency** therefore uses response length only as a rough proxy, not actual tokens per correct answer. **Speed** is the end-to-end delegated run time and includes provider/tool waiting. **Error Recovery** is only evidenced when an agent corrected a test or harness issue; no external error was injected. “Best fit” names the strongest areas evidenced by this short battery and is not a broad specialist ranking.

## Outcome summary

- 14 entries returned a complete three-part report.
- 2 entries returned partial or insufficiently verifiable reports.
- 7 entries failed before a usable complete answer, due to rate limits, endpoint availability, or tool-routing restrictions.
- One completed result returned `$6480` for the requested price of `$64.80`; it receives a major math-accuracy and hallucination penalty.
- The free-model router can select changing underlying endpoints; its result is not attributable to one stable model identity.

The dashboard stores only short evaluation summaries, evidence, scores, and provider failure notes. It does not store the full model responses.

## Supabase load

Apply `supabase/migrations/20261026000004_benchmark_scorecards.sql` first, then run `supabase/seed_opencode_free_20261026.sql` in the authenticated Supabase SQL Editor. The seed is idempotent and publishes the benchmark rows so the read-only dashboard can display them. The browser app uses only its publishable key and cannot write to Supabase.
