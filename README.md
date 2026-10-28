# OpenScouter

OpenScouter is a read-only dashboard for exploring a snapshot of free AI models tested through OpenCode. It helps you compare results across a small shared task battery and choose models for work such as coding, reasoning, and security review.

The dashboard lets you search and filter the catalog, sort by overall score, task completion, or speed, and inspect the evidence behind each score. Its prompt builder can use the benchmark's best-fit categories to suggest models for different roles.

## How to read the results

The benchmark is a snapshot, not a live measure of every model or provider. Each catalog entry received one run, so scores are useful as a starting point rather than a guarantee of future performance. Provider failures are shown separately from answer quality. See [BENCHMARK_METHODOLOGY.md](BENCHMARK_METHODOLOGY.md) for the tasks, scoring approach, and limitations.

By default, the site uses its bundled benchmark data. If Supabase is configured, it reads the latest published results instead. The website is a viewer: it does not create, edit, or publish database records. Supabase access uses a publishable key and published-row policies; never put a service-role key in the browser app.

## Run locally

```sh
npm ci
cp .env.example .env.local
# Edit .env.local with your Supabase URL and publishable key, if using Supabase.
npm run dev
```

Supabase configuration is optional. Without it, the bundled results remain available. To create a production build, run `npm run build`.
