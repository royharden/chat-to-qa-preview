# Fixture provenance

Every file under `fixtures/refusals/` and `fixtures/accept/` was written by hand on 2026-10-27 by
0814_Claude_Opus55_Sub_S47CodeM1 (builder lineage, milestone M1). All text is invented. Nothing was copied or
derived from a real chat export, a `.chatexports` folder, a public dataset or any held-out material. No file contains
an email address, phone number, host, path, token or other identifier-shaped value. These fixtures test parsing
only; they carry no labels and are never evaluation data.

| Folder | Purpose |
|---|---|
| `refusals/` | Exactly one file per refusal code, named `<code>.<ext>`; size refusals are `<code>.recipe.json` recipes expanded at test time (format in `docs/FORMAT.md` §4). Byte-exact (`-text`). |
| `accept/` | Inputs that must import: `basic.md` (and its CRLF twin `basic.crlf.md`), `fences.md` (no cursor line on purpose), `preamble.md`, `session.json`, `bom.json.txt` (BOM-prefixed JSON, non-`.json` extension). |
