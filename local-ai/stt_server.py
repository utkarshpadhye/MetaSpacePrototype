from __future__ import annotations

import os
import tempfile
from pathlib import Path

import av
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv('METASPACE_STT_MODEL', 'base.en')
DEVICE = os.getenv('METASPACE_STT_DEVICE', 'cpu')
COMPUTE_TYPE = os.getenv('METASPACE_STT_COMPUTE_TYPE', 'int8')

app = FastAPI(title='MetaSpace Local STT')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)


def _transcribe_text(path: str, vad_filter: bool) -> tuple[str, str, float, float]:
    segments, info = model.transcribe(
        path,
        vad_filter=vad_filter,
        beam_size=3,
        temperature=0.0,
        language='en',
        condition_on_previous_text=False,
        compression_ratio_threshold=2.2,
        log_prob_threshold=-1.0,
        no_speech_threshold=0.5,
    )
    segment_list = list(segments)
    text = ' '.join(segment.text.strip() for segment in segment_list).strip()

    if not segment_list:
        return text, info.language, -10.0, 1.0

    avg_logprob = sum(segment.avg_logprob for segment in segment_list) / len(segment_list)
    no_speech = sum(segment.no_speech_prob for segment in segment_list) / len(segment_list)
    return text, info.language, avg_logprob, no_speech


def _pick_suffix(file: UploadFile) -> str:
    ext = Path(file.filename or '').suffix.lower()
    if ext in {'.webm', '.mp4', '.m4a', '.ogg', '.wav'}:
        return ext

    content_type = (file.content_type or '').lower()
    if 'webm' in content_type:
        return '.webm'
    if 'ogg' in content_type:
        return '.ogg'
    if 'mp4' in content_type or 'mpeg' in content_type or 'm4a' in content_type:
        return '.mp4'
    if 'wav' in content_type:
        return '.wav'

    return '.webm'


@app.get('/health')
def health() -> dict[str, str]:
    return {
        'status': 'ok',
        'model': MODEL_SIZE,
        'device': DEVICE,
        'compute_type': COMPUTE_TYPE,
    }


@app.post('/transcribe')
async def transcribe(file: UploadFile = File(...)) -> dict[str, str | bool | float]:
    suffix = _pick_suffix(file)

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        content = await file.read()
        if not content:
            return {
                'text': '',
                'language': '',
                'ignored': True,
                'avg_logprob': -10.0,
                'no_speech_prob': 1.0,
            }
        temp_file.write(content)

    try:
        try:
            text, language, avg_logprob, no_speech_prob = _transcribe_text(
                str(temp_path),
                vad_filter=True,
            )
            if not text:
                text, language, avg_logprob, no_speech_prob = _transcribe_text(
                    str(temp_path),
                    vad_filter=False,
                )
            return {
                'text': text,
                'language': language,
                'ignored': False,
                'avg_logprob': avg_logprob,
                'no_speech_prob': no_speech_prob,
            }
        except av.error.InvalidDataError:
            # Some MediaRecorder slices are not independently decodable.
            return {
                'text': '',
                'language': '',
                'ignored': True,
                'avg_logprob': -10.0,
                'no_speech_prob': 1.0,
            }
    finally:
        temp_path.unlink(missing_ok=True)


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('stt_server:app', host='127.0.0.1', port=8765, reload=False)
