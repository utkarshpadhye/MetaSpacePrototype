# MetaSpacePrototype

MetaSpacePrototype is a frontend prototype for a virtual collaborative space.
The runnable web app lives in the `app` folder (React + TypeScript + Vite).

## Repository Layout

- `app/`: main frontend application
- `sprite-resources/`: source art and sprite assets used by the prototype
- `frontend-spec.md`: product and UX specification notes
- `frontend-implementation-plan.md`: implementation planning notes

## Quick Start (New Machine)

### 1. Prerequisites

Install the following tools first:

- Node.js 20+ (LTS recommended)
- npm 10+ (comes with recent Node.js)
- Git

Optional (only if you want to run sprite utility scripts):

- Python 3.10+
- pip package `Pillow`

### 2. Clone

```bash
git clone https://github.com/utkarshpadhye/MetaSpacePrototype.git
cd MetaSpacePrototype
```

### 3. Install frontend dependencies

```bash
cd app
npm install
```

### 4. Start development server

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.

## Useful Commands

Run these inside `app/`:

```bash
npm run dev      # start local dev server
npm run build    # type-check and create production build
npm run preview  # preview production build locally
npm run lint     # run ESLint checks
```

## Local AI Conference Captions + Summary

Conference room now supports:

- Live speech-to-text captions
- Auto-generated meeting summary (key points, actions, decisions)

Everything is local-only. No external transcription API calls are used.

### Start the local STT service

From repo root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r local-ai/requirements.txt
python local-ai/stt_server.py
```

The service runs on `http://127.0.0.1:8765`.

Optional model tuning via env vars:

```bash
export METASPACE_STT_MODEL=base.en
export METASPACE_STT_DEVICE=cpu
export METASPACE_STT_COMPUTE_TYPE=int8
python local-ai/stt_server.py
```

### Run frontend

In another terminal:

```bash
cd app
npm run dev
```

Then enter the conference room and use:

- `Captions On/Off`
- `Clear Notes`
- `Share Screen`
- `Mic On/Off`

## Optional: Sprite Utility Script

There is a helper script at `app/scripts/stitch_sprite.py`.

If you want to run it:

```bash
python -m pip install Pillow
python app/scripts/stitch_sprite.py
```

Note: this script currently contains machine-specific absolute paths. If your folder layout differs, update `SRC` and `OUT_DIR` in the script before running it.

## Will it work after cloning?

Yes, the frontend app should run on a fresh machine after:

1. Installing Node.js and npm
2. Running `npm install` in `app/`
3. Starting with `npm run dev`

If something fails, the most common cause is an incompatible Node.js version.
