# Next Track: build plan

A DJ tool that answers "what should I play next?" by how tracks actually
*sound*, using Appwrite **VectorsDB** as the recommendation engine.

Deadline: 11:59 PM PT, Oct 31 2026. Rules: solo, built from scratch, one
Appwrite database type only (VectorsDB).

## How it works

```
your music folder
      │  ingest/analyse.py  (local, Python)
      │    - CLAP audio embedding (512-d, sound fingerprint)
      │    - BPM + key from tags, else estimated with librosa
      ▼
out/tracks.jsonl
      │  ingest/upload.mjs  (node-appwrite)
      ▼
Appwrite VectorsDB  ── collection "tracks", dimension 512, HNSW cosine index
      ▲
      │  vectorCosine(track.embeddings) + BPM / Camelot filters
SvelteKit web app  ── pick the playing track → ranked next-track suggestions
```

Audio never leaves the machine. Only the fingerprint and metadata are uploaded.

Stack: SvelteKit, hosted on **Appwrite Sites**, talking to VectorsDB.

## Judging criteria and how we hit them

| Criterion | Our angle |
|---|---|
| Idea and innovation | Suggestions based on how a track *sounds*, not tags or popularity. It's a real DJ problem, built by a DJ. |
| Technical execution | Local CLAP pipeline, stable IDs and resumable ingest, harmonic + tempo filters combined with vector search. |
| Design and experience | It should feel like a deck: a "playing now" card, a suggestions list with BPM/key badges and a match %, one-click "play next" to keep chaining. |
| Usage of Appwrite Databases | VectorsDB *is* the recommender: HNSW cosine index, vector query + metadata filters in one request, `$distance` shown as match %. Say this explicitly in the README and the video. |

## Data model

Database: VectorsDB `nexttrack`, collection `tracks`, `dimension: 512`.
Index on `embeddings`, type `hnsw_cosine`, queried with `Query.vectorCosine`.

| Field | Example | Notes |
|---|---|---|
| `$id` | `3f9a…` | sha1 of the file's relative path, so re-runs update instead of duplicating |
| `embeddings` | `[0.012, …]` | 512 floats: mean of 3 × 10 s CLAP windows, centred on the crate's mean vector and L2-normalised (spreads similarities so % match means something) |
| `metadata.title` | `Rolling Thunder` | from tags, else file name |
| `metadata.artist` | `…` | |
| `metadata.genre` | `Minimal` | |
| `metadata.bpm` | `126.0` | float, for display; half/double-time folded into 80–180 |
| `metadata.bpm_int` | `"126"` | string, for `Query.equal` filters (VectorsDB filter values must be strings) |
| `metadata.camelot` | `"8A"` | for harmonic-mixing filters |
| `metadata.key` | `"A minor"` | for display |
| `metadata.duration` | `412.3` | seconds |
| `metadata.bpm_source` / `key_source` | `"tags"` / `"estimated"` | shows how much to trust them |

### The "next track" query

1. `getDocument(track)` to fetch the playing track's vector.
2. `listDocuments` (or `createQuery` to keep the vector out of the URL) with:
   - `Query.vectorCosine('embeddings', vector)`
   - `Query.equal('metadata.camelot', ['8A', '7A', '9A', '8B'])`: same key, ±1, relative major/minor
   - `Query.equal('metadata.bpm_int', ['119', …, '133'])`: ±6% of 126
   - `Query.notEqual('$id', track)`, `Query.limit(10)`
3. Show the results ranked by `$distance`.

We use a list of integer BPMs rather than `between` because filter values are
strings, and string ranges sort "95" after "130".

## Plan (Oct 22–31)

| Day | Goal |
|---|---|
| Thu 22 | Repo, plan, ingest script. Run it on ~50 tracks. |
| Fri 23 | Create the VectorsDB database, collection and index. Upload. Sanity-check that the neighbours sound right. |
| Sat 24–Sun 25 | SvelteKit app: track list/search, "playing now" card, next-track suggestions with BPM/key badges. |
| Mon 26 | Filters UI (BPM tolerance, strict/loose harmonic, energy up/down). Ingest the full crate. |
| Tue 27 | Stretch: "set path" from track A to B. Stretch: text-vibe search. |
| Wed 28 | Polish, deploy to Appwrite Sites, README with screenshots. |
| Thu 29 | Record the demo video (2–3 min). |
| Fri 30 | Buffer. Make the repo **public**. |
| Sat 31 | Submit the form well before 11:59 PM PT. |

## Stretch ideas

- **Text vibe search** ("dark rolling minimal"): CLAP puts text and audio in
  the same space, so a text embedding can be the query vector. It needs CLAP
  at query time, so either an Appwrite Function or a tiny local API. The
  built-in `createTextEmbeddings` (nomic) won't work here because it's a
  different vector space.
- **Set path**: greedy walk from A towards B, picking at each step the
  nearest unplayed neighbour that is closer to B.
- **Preview**: 30 s clips in Appwrite Storage (Storage isn't a database, so it
  shouldn't break the one-database rule, but worth confirming).

## Open questions to verify against the docs

- Exact `createIndex` call for VectorsDB (or just make the index in the Console).
- Whether `Query.equal` accepts an array of values on `metadata.*` fields.
- Bulk create for faster uploads (`bulk-operations` docs page).
- Python SDK support for VectorsDB. Until then, uploads go through Node, which is documented.

Docs: [VectorsDB](https://appwrite.io/docs/products/databases/vectorsdb) ·
[Vector search](https://appwrite.io/docs/products/databases/vectorsdb/vector-search) ·
[Queries](https://appwrite.io/docs/products/databases/vectorsdb/queries)
