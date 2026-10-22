"""Analyse a folder of music into out/tracks.jsonl for upload to VectorsDB.

For each track: a 512-d CLAP audio embedding (the "sound fingerprint"),
plus title/artist/genre, BPM and key. BPM and key come from file tags when
present (Rekordbox / Mixed In Key usually write them), else are estimated.

Usage:
    python analyse.py ~/Music/crate --out ../out/tracks.jsonl
    python analyse.py ~/Music/crate --range 101-200   # tracks 101 to 200, in sorted path order

Tracks already analysed (with the current analysis version) are skipped, so runs can
be split up or resumed without redoing or overwriting anything.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import librosa
import mutagen
import numpy as np
import torch
from transformers import ClapModel, ClapProcessor

MODEL_ID = "laion/larger_clap_music"
SAMPLE_RATE = 48_000  # CLAP expects 48 kHz
WINDOW_SECONDS = 10
WINDOW_POSITIONS = (0.3, 0.4, 0.5, 0.6)  # the body of the track, past DJ intros
PEAK_SEARCH = (0.2, 0.85)  # where to look for the drop: past drum intros, before outros
ANALYSIS_VERSION = 3  # bump when the analysis changes, so old results get redone
AUDIO_EXTS = {".mp3", ".flac", ".wav", ".aiff", ".aif", ".m4a", ".ogg"}

# Camelot wheel: (pitch class, is_minor) -> code. C=0 … B=11.
CAMELOT = {
    (11, False): "1B", (8, True): "1A",
    (6, False): "2B", (3, True): "2A",
    (1, False): "3B", (10, True): "3A",
    (8, False): "4B", (5, True): "4A",
    (3, False): "5B", (0, True): "5A",
    (10, False): "6B", (7, True): "6A",
    (5, False): "7B", (2, True): "7A",
    (0, False): "8B", (9, True): "8A",
    (7, False): "9B", (4, True): "9A",
    (2, False): "10B", (11, True): "10A",
    (9, False): "11B", (6, True): "11A",
    (4, False): "12B", (1, True): "12A",
}
CAMELOT_TO_KEY = {v: k for k, v in CAMELOT.items()}
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NOTE_ALIASES = {"DB": "C#", "EB": "D#", "GB": "F#", "AB": "G#", "BB": "A#"}

# Krumhansl-Schmuckler key profiles, for estimating key from chroma.
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def key_name(pitch, minor):
    return f"{NOTE_NAMES[pitch]} {'minor' if minor else 'major'}"


def parse_key_tag(raw):
    """Turn a key tag ("8A", "Am", "F#m", "A minor") into (pitch, is_minor)."""
    s = raw.strip().upper().replace("♯", "#").replace("♭", "B")
    if re.fullmatch(r"(1[0-2]|[1-9])[AB]", s):
        return CAMELOT_TO_KEY[s]
    m = re.fullmatch(r"([A-G])([#B]?)\s*(M|MIN|MINOR|MAJ|MAJOR)?", s)
    if not m:
        return None
    note = m.group(1) + m.group(2)
    note = NOTE_ALIASES.get(note, note)
    if note not in NOTE_NAMES:
        return None
    minor = m.group(3) in ("M", "MIN", "MINOR")
    return NOTE_NAMES.index(note), minor


def read_tags(path):
    """Best-effort title/artist/genre/bpm/key from whatever tag format the file has."""
    tags = {}
    try:
        easy = mutagen.File(path, easy=True)
        if easy and easy.tags:
            for field in ("title", "artist", "album", "genre", "bpm"):
                if easy.tags.get(field):
                    tags[field] = str(easy.tags[field][0])
        raw = mutagen.File(path)
        if raw and raw.tags:
            for k, v in raw.tags.items():
                # TKEY (ID3), TXXX:INITIALKEY, initialkey (FLAC), ----:…:initialkey (MP4)
                if "key" in str(k).lower():
                    value = v.text[0] if hasattr(v, "text") else v
                    if isinstance(value, list):
                        value = value[0]
                    if isinstance(value, bytes):
                        value = value.decode(errors="ignore")
                    if str(value).strip():
                        tags.setdefault("key", str(value))
    except Exception as e:  # unreadable tags shouldn't stop the run
        print(f"  tags unreadable: {e}", file=sys.stderr)
    return tags


def fold_bpm(bpm):
    # Fold half/double-time values (from tags or estimates) into the usual DJ range.
    while bpm and bpm < 80:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return bpm


def estimate_bpm(y, sr):
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    return float(np.atleast_1d(tempo)[0])


def estimate_key(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
    best = None
    for pitch in range(12):
        for minor, profile in ((False, MAJOR_PROFILE), (True, MINOR_PROFILE)):
            score = np.corrcoef(chroma, np.roll(profile, pitch))[0, 1]
            if best is None or score > best[0]:
                best = (score, pitch, minor)
    return best[1], best[2]


def energy_peak(path, duration):
    """Find the track's drop (its biggest 10 s moment) and how big it is.

    Each 10 s window gets a level (loudness + rhythmic density, z-scored within the
    track) and a rise (its level minus the 4-20 s before it). The drop is the window
    with the highest level + rise, so a big hit after a breakdown beats a steady loud
    groove, and DJ intros/outros are outside the search range. The raw values at the
    drop are kept, so upload can rank energy across the whole crate: a chill track with
    one huge payoff scores high, because energy is its peak, not its average.
    """
    sr, hop = 11_025, 512
    y, _ = librosa.load(path, sr=sr, mono=True)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    n = min(len(rms), len(onset))
    fps = sr / hop
    win, step = int(WINDOW_SECONDS * fps), int(2 * fps)
    starts = list(range(0, max(1, n - win), step))
    loud = np.array([20 * np.log10(rms[s : s + win].mean() + 1e-9) for s in starts])
    busy = np.array([onset[s : s + win].mean() for s in starts])
    z = lambda a: (a - a.mean()) / (a.std() + 1e-9)
    level = z(loud) + z(busy)
    before = np.array([level[max(0, i - 10) : max(1, i - 2)].mean() for i in range(len(starts))])
    score = level + (level - before)

    lo, hi = int(len(starts) * PEAK_SEARCH[0]), int(len(starts) * PEAK_SEARCH[1])
    candidates = range(lo, hi) if hi > lo else range(len(starts))
    best = max(candidates, key=lambda i: score[i])
    return {
        "peak_at": round(min(starts[best] / fps, max(0.0, duration - WINDOW_SECONDS)), 1),
        "peak_rms_db": round(float(loud[best]), 2),
        "peak_onset": round(float(busy[best]), 3),
    }


def clap_windows(path, duration, peak_at):
    """Load 10 s windows at 48 kHz: the body of the track, plus its peak moment."""
    offsets = [max(0.0, duration * pos - WINDOW_SECONDS / 2) for pos in WINDOW_POSITIONS] + [peak_at]
    windows = []
    for offset in offsets:
        y, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True, offset=offset, duration=WINDOW_SECONDS)
        if len(y) >= SAMPLE_RATE:  # skip windows under 1 s
            windows.append(y)
    return windows


def embed(model, processor, windows):
    try:
        inputs = processor(audio=windows, sampling_rate=SAMPLE_RATE, return_tensors="pt")
    except TypeError:  # older transformers name the argument `audios`
        inputs = processor(audios=windows, sampling_rate=SAMPLE_RATE, return_tensors="pt")
    with torch.no_grad():
        feats = model.get_audio_features(**inputs)
    if not torch.is_tensor(feats):  # transformers 5 returns a ModelOutput
        feats = feats.pooler_output
    vec = feats.mean(dim=0).numpy()
    return (vec / np.linalg.norm(vec)).astype(float)


def track_id(rel_path):
    # Appwrite IDs: max 36 chars, a-z0-9. Stable per file so re-runs update.
    return hashlib.sha1(rel_path.encode()).hexdigest()[:32]


def analyse(path, root, model, processor, audio=None):
    # `audio` is what gets decoded; tags and the ID always come from the original file.
    audio = audio or path
    duration = librosa.get_duration(path=audio)
    tags = read_tags(path)

    # 60 s from the middle at 22 kHz is enough for BPM/key estimates.
    mid, _ = librosa.load(audio, sr=22_050, mono=True, offset=max(0.0, duration / 2 - 30), duration=60)

    bpm, bpm_source = None, "tags"
    try:
        bpm = float(tags["bpm"])
    except (KeyError, ValueError):
        pass
    if not bpm:
        bpm, bpm_source = estimate_bpm(mid, 22_050), "estimated"
    bpm = fold_bpm(bpm)

    parsed = parse_key_tag(tags["key"]) if "key" in tags else None
    key_source = "tags"
    if parsed is None:
        parsed, key_source = estimate_key(mid, 22_050), "estimated"
    pitch, minor = parsed

    peak = energy_peak(audio, duration)

    rel = str(path.relative_to(root))
    return {
        "id": track_id(rel),
        "embeddings": embed(model, processor, clap_windows(audio, duration, peak["peak_at"])).tolist(),
        "metadata": {
            "title": tags.get("title") or path.stem,
            "artist": tags.get("artist", ""),
            "album": tags.get("album", ""),
            "genre": tags.get("genre", ""),
            "bpm": round(bpm, 1),
            "bpm_int": str(round(bpm)),
            "key": key_name(pitch, minor),
            "camelot": CAMELOT[(pitch, minor)],
            "duration": round(duration, 1),
            "bpm_source": bpm_source,
            "key_source": key_source,
            **peak,
            "file": rel,
            "analysis": ANALYSIS_VERSION,
        },
    }


def analyse_via_wav(path, root, model, processor):
    # Some MP3s have stream quirks the default decoder can't seek past. ffmpeg decodes them
    # fine, so convert to a temporary WAV (outside the music folder) and analyse that.
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not installed (brew install ffmpeg)")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "track.wav"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "44100", str(wav)],
            check=True,
            capture_output=True,
        )
        return analyse(path, root, model, processor, audio=wav)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--out", type=Path, default=Path("../out/tracks.jsonl"))
    parser.add_argument("--limit", type=int, help="only analyse the first N tracks (for testing)")
    parser.add_argument("--range", help="only analyse tracks START-END (1-based, inclusive), e.g. 101-200")
    args = parser.parse_args()

    root = args.folder.expanduser().resolve()
    files = sorted(p for p in root.rglob("*") if p.suffix.lower() in AUDIO_EXTS)
    total = len(files)
    first = 1
    if args.range:
        start, _, end = args.range.partition("-")
        first = int(start)
        files = files[first - 1 : int(end) if end else total]
    if args.limit:
        files = files[: args.limit]

    # Skip tracks already analysed with the current version, so a long run can be resumed.
    # Tracks from an older version are redone; the new line is appended and upload uses
    # the latest line per track, so nothing earlier is overwritten.
    args.out.parent.mkdir(parents=True, exist_ok=True)
    done = set()
    if args.out.exists():
        for line in args.out.open():
            if line.strip():
                row = json.loads(line)
                if row["metadata"].get("analysis") == ANALYSIS_VERSION:
                    done.add(row["id"])

    print(f"Loading {MODEL_ID}…")
    model = ClapModel.from_pretrained(MODEL_ID).eval()
    processor = ClapProcessor.from_pretrained(MODEL_ID)

    with args.out.open("a") as out:
        for i, path in enumerate(files, first):
            if track_id(str(path.relative_to(root))) in done:
                print(f"[{i}/{total}] {path.name} (already analysed)", flush=True)
                continue
            print(f"[{i}/{total}] {path.name}", flush=True)
            try:
                try:
                    row = analyse(path, root, model, processor)
                except Exception as e:
                    print(f"  decode failed ({e}), retrying via ffmpeg", file=sys.stderr)
                    row = analyse_via_wav(path, root, model, processor)
                out.write(json.dumps(row) + "\n")
                out.flush()
            except Exception as e:
                print(f"  skipped: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
