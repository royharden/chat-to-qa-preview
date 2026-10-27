# Synthetic session: keeping a build cache across restarts

- Provenance: synthetic M1 accept fixture, 0814_Claude_Opus55_Sub_S47CodeM1 (builder lineage), 2026-10-27
- Nothing here comes from a real export.

## 👤 User

How do I make the build cache survive restarts?

## 🤖 Assistant

Set the cache directory to a persistent path.

## Notes inside an answer

This plain heading is content, and a mid-line <b>tag</b> mention stays text.

```sh
## 👤 User
<div>inside a fence this is content</div>
```

<details>
<summary>Tool: read_file</summary>

tool output that is dropped from the session

</details>

Then run the build again.

## 👤 User

Thanks. Does the same setting work in CI?

## 🤖 Assistant

Yes, use the same setting in the CI job.

<!-- xexport-cursor synthetic-fixture -->
