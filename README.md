# Next Track

**What should I play next?** Next Track suggests your next tune by how tracks
actually *sound*, filtered to a mixable BPM and a harmonically compatible key.

Built for the Appwrite hackathon (Oct 2026) on **Appwrite VectorsDB**, which
does the recommending: every track is stored as a 512-dimension CLAP audio
embedding, and "what's next" is a cosine-similarity vector query combined with
BPM and Camelot-key filters.

> Work in progress. See [docs/PLAN.md](docs/PLAN.md) for the design and schedule.

## Indexing your crate

```bash
# 1. Analyse locally (audio never leaves your machine)
cd ingest
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python analyse.py ~/Music/crate --limit 50   # writes ../out/tracks.jsonl

# 2. Upload fingerprints + metadata to VectorsDB
cp ../.env.example ../.env   # fill in project ID, API key, IDs
npm install
npm run upload
```

Before uploading, create in the Appwrite Console a VectorsDB database
`nexttrack` with a collection `tracks` (dimension **512**) and an
`hnsw_cosine` index on `embeddings`.
