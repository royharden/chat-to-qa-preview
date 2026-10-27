# Evaluation contract — unexecuted source

The default CLI is mock/keyless. Builder-dev recipes have `lineage: builder-dev` and never establish an independent result.
After authorization and offline validation: `node scripts/eval.ts --mock --out results/run-dev-001`.
The output directory must not exist and is reserved before evaluation. It contains results.jsonl, results.md, failures.jsonl and run.json;
no planted surface string is logged. Every row declares dev_diagnostic, heldout_first_run or known_set_diagnostic.
Columns retain `not_run` or `NA` where a measurement has not happened or has a zero denominator. Cells below ten report counts.
Only the R2 pipeline can reach provider code; the R0/R1 controls remain under leakeval.

Controlled targets are exact gold spans assembled as a question/answer source, transformed through each arm and the shared serializer.
End-to-end rows select a pair from the whole transformed session. R2 uses full rescan; the control arms use their own redaction policy.
The oracle imports no detector and checks planted values and one-pass variants separately. Citations, metadata, excerpts and bytes all
participate in its surface. Two file formats never become two sessions. Metrics remain diagnostic; selection misses are reported separately.
Identifier counts use session/identifier tuple keys. Artifact outcomes, decoy loss and anchor/span utility use separate artifact/target
traces, deduplicated across class rows within each family and format. Aggregated rows retain unioned traces and summed utility counts.

## Independent edition admission

Roy must appoint the custodian. Builders never prepare hidden bundles, labels, tiny oracle examples or the GO receipt.
No builder command defaults to a sealed path. The CLI consumes only explicitly supplied paths after a GO and hash check.

Held-out invocation after appointment and offline validation:

```
node scripts/eval.ts --mock --heldout --first-heldout-run --receipt <receipt> --templates <template-set> --materialised <materialised-set> --labels <label-set> --oracle <oracle-file> --dev-templates <dev-template-set> --bundle <bundle-inside-materialised-set> --edition <independent-edition> --out results/run-heldout-001
```

All set digests use the shared manifestHash.ts algorithm from DATA.md. The dev-template-set contains only the ten template recipes;
it must match the receipt's dev_templates_sha256, not the entire fixtures/dev folder with labels and manifest.
The bundle is an array of objects with `id` and `input`. Each input has `session.turns` (id, role, text), `identifiers` and `decoys`
(id, kind, value), `question` (turn_id, start, end), and `targets` (id, spans, slot_ids, anchors). Offsets are UTF-16 half-open.
The materialised bundle and its literal values stay untracked in the independently managed set. The receipt binds the whole set,
templates, labels and oracle examples. First reveal is the run of record; preserve every outcome and named miss.
After any post-reveal fix, replace --first-heldout-run with --known-set-diagnostic <first-output-directory> and use a new output
directory. The diagnostic must reference first-run metadata for the same admitted hashes, records its metadata digest, and never
rewrites the first output. The explicit first-run designation is an operator assertion; changing --edition does not establish a newly
independent dataset. Custodian provenance and a new independently authored edition remain necessary for a new independent claim.
NO_GO, absent appointment/receipt, missing checks or any mismatch refuse evaluation. No eval-freeze-v1 tag is made by these tools.

## Honest activation

No command here has run. Recheck source freeze, code/prereg hashes, oracle examples, approval and boundary tests before a reveal.
Dev high-tier leaks or failing boundary/approval checks stop live/reveal. Post-reveal fixes are known-set diagnostics; a new independent
claim needs a new edition. Paid runs require Roy-supplied access, explicit provider notice/confirmation and a verified price/model.
The STOP predicate includes high-tier R2 residuals at whole-transcript and request boundaries even when no public artifact was eligible.

The funded CLI also requires exactly one names-review action: --no-names, or --reviewed-names <JSON-file> containing a nonempty array
of reviewed terms. Provider-send confirmation is separate. Reviewed terms apply both to source redaction and final artifact rescan.
--dev-manifest must name <root>/fixtures/dev/MANIFEST.json. The CLI accepts only that manifest and its ten in-repo recipe/label pairs,
checks canonical paths, and compares the exact LF-normalised text consumed with per-file digests recomputed by the verified source
freeze. An external manifest, missing frozen file, symlink escape or changed file refuses preparation before provider dispatch.

Source snapshots use `source_snapshot_algorithm: s47.source-snapshot.v1`. Every tracked regular file under `src/`, `scripts/`,
`supabase/`, `fixtures/` and `tests/` is included. `source_snapshot_files` records each raw-byte SHA-256 plus its canonical digest:
an explicit indexed Git `-text` attribute selects `raw-bytes` (including byte-exact refusal fixtures); every other file selects
`utf8-lf`, requiring valid UTF-8 and normalising CRLF/lone CR to LF. Invalid application text never falls back to binary. The existing
`source_files` path/digest view retains the LF-normalised dev manifest, recipe and label hashes used by live input binding.
Paths are repository-relative with `/` separators; absolute/drive paths, backslashes, CR/LF, empty or dot segments and duplicates
refuse, as do symlink/nonregular source paths. Sort paths by UTF-8 bytes. The manifest is the algorithm id plus LF, then one compact JSON tuple
`[path,encoding,raw_sha256,sha256]` plus LF per file in that order; `source_manifest_sha256` hashes those UTF-8 manifest bytes.
Both raw binary changes and raw text line-ending changes therefore alter the source snapshot. Held-out/dev-set N13 manifest hashing
in `manifestHash.ts` is unchanged and remains LF-normalised text only. These snapshot regressions have not run.
