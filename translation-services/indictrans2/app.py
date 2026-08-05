import os
import re
from functools import lru_cache

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from processor import IndicProcessor

LANG_TAGS = {
    "en": "eng_Latn",
    "ta": "tam_Taml",
    "ml": "mal_Mlym",
    "hi": "hin_Deva",
    "te": "tel_Telu",
    "kn": "kan_Knda",
}
MODEL_NAMES = {
    "en-indic": os.getenv("INDICTRANS2_EN_INDIC_MODEL", "ai4bharat/indictrans2-en-indic-dist-200M"),
    "indic-en": os.getenv("INDICTRANS2_INDIC_EN_MODEL", "ai4bharat/indictrans2-indic-en-dist-200M"),
    "indic-indic": os.getenv("INDICTRANS2_INDIC_INDIC_MODEL", "ai4bharat/indictrans2-indic-indic-dist-320M"),
}
PROTECTED = re.compile(
    r"https?://\S+|www\.\S+|@[\w.]+|#[\w]+|"
    r"[\U0001F1E6-\U0001F1FF\U0001F300-\U0001FAFF\u2600-\u27BF]+",
    re.UNICODE,
)

app = FastAPI(title="P4U IndicTrans2", version="1.0.0")
processor = IndicProcessor(inference=True)


class TranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    targetLanguage: str
    sourceLanguage: str | None = None


def detect_language(text: str) -> str:
    counts = {
        "ta": len(re.findall(r"[\u0B80-\u0BFF]", text)),
        "ml": len(re.findall(r"[\u0D00-\u0D7F]", text)),
        "hi": len(re.findall(r"[\u0900-\u097F]", text)),
        "te": len(re.findall(r"[\u0C00-\u0C7F]", text)),
        "kn": len(re.findall(r"[\u0C80-\u0CFF]", text)),
    }
    language, count = max(counts.items(), key=lambda item: item[1])
    return language if count else "en"


def protect(text: str):
    values: list[str] = []

    def replace(match: re.Match):
        values.append(match.group(0))
        return f"__P4U{len(values) - 1}__"

    return PROTECTED.sub(replace, text), values


def restore(text: str, values: list[str]):
    for index, value in enumerate(values):
        text = re.sub(rf"__\s*P4U\s*{index}\s*__", lambda _: value, text, flags=re.IGNORECASE)
    return text


@lru_cache(maxsize=3)
def load_model(direction: str):
    name = MODEL_NAMES[direction]
    tokenizer = AutoTokenizer.from_pretrained(name, trust_remote_code=True)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForSeq2SeqLM.from_pretrained(name, trust_remote_code=True, torch_dtype=dtype)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).eval()
    return tokenizer, model, device


def translate_lines(lines: list[str], source: str, target: str) -> list[str]:
    direction = "en-indic" if source == "en" else "indic-en" if target == "en" else "indic-indic"
    tokenizer, model, device = load_model(direction)
    processed = processor.preprocess_batch(lines, src_lang=LANG_TAGS[source], tgt_lang=LANG_TAGS[target])
    inputs = tokenizer(processed, padding="longest", truncation=True, max_length=512, return_tensors="pt").to(device)
    with torch.inference_mode():
        generated = model.generate(**inputs, num_beams=5, max_length=512)
    decoded = tokenizer.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
    return processor.postprocess_batch(decoded, lang=LANG_TAGS[target])


@app.get("/health")
def health():
    return {"status": "UP", "engine": "IndicTrans2", "device": "cuda" if torch.cuda.is_available() else "cpu"}


@app.post("/translate")
def translate(payload: TranslationRequest):
    target = payload.targetLanguage.lower().strip()
    source = (payload.sourceLanguage or detect_language(payload.text)).lower().strip()
    if source not in LANG_TAGS or target not in LANG_TAGS:
        raise HTTPException(status_code=400, detail="Unsupported source or target language")
    if source == target:
        return {"translatedText": payload.text, "sourceLanguage": source, "targetLanguage": target}

    protected_lines: list[str] = []
    placeholders: list[list[str]] = []
    for line in payload.text.split("\n"):
        protected, values = protect(line)
        protected_lines.append(protected if protected.strip() else " ")
        placeholders.append(values)
    try:
        translated = translate_lines(protected_lines, source, target)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"IndicTrans2 inference failed: {error}") from error
    restored = [restore(line, values) for line, values in zip(translated, placeholders)]
    return {"translatedText": "\n".join(restored), "sourceLanguage": source, "targetLanguage": target}
