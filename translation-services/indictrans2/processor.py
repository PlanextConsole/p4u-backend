"""Pure-Python IndicTrans2 preprocessing for Windows CPU deployments.

The published IndicTransToolkit package exposes the same operations through a
Cython extension, which requires Visual C++ Build Tools on Windows. This small
implementation keeps the official normalization, tokenization,
transliteration, language-tag, and detokenization pipeline without that native
build dependency.
"""

import re

from indicnlp.normalize.indic_normalize import IndicNormalizerFactory
from indicnlp.tokenize import indic_detokenize, indic_tokenize
from indicnlp.transliterate.unicode_transliterate import UnicodeIndicTransliterator
from sacremoses import MosesDetokenizer, MosesPunctNormalizer, MosesTokenizer


class IndicProcessor:
    _iso_codes = {
        "eng_Latn": "en",
        "hin_Deva": "hi",
        "tam_Taml": "ta",
        "mal_Mlym": "ml",
        "tel_Telu": "te",
        "kan_Knda": "kn",
    }

    def __init__(self, inference=True):
        self.inference = inference
        self._en_tokenizer = MosesTokenizer(lang="en")
        self._en_normalizer = MosesPunctNormalizer()
        self._en_detokenizer = MosesDetokenizer(lang="en")
        self._transliterator = UnicodeIndicTransliterator()

    @staticmethod
    def _punctuation(text):
        text = text.replace("\r", "").strip()
        return re.sub(r"[ ]{2,}", " ", text)

    def preprocess_batch(self, batch, src_lang, tgt_lang=None, is_target=False, **_kwargs):
        iso = self._iso_codes.get(src_lang)
        if not iso or (not is_target and not tgt_lang):
            raise ValueError("Unsupported IndicTrans2 language tag")
        normalizer = None if iso == "en" else IndicNormalizerFactory().get_normalizer(iso)
        output = []
        for sentence in batch:
            sentence = self._punctuation(sentence)
            if iso == "en":
                normalized = self._en_normalizer.normalize(sentence)
                processed = " ".join(self._en_tokenizer.tokenize(normalized, escape=False))
            else:
                normalized = normalizer.normalize(sentence)
                processed = " ".join(indic_tokenize.trivial_tokenize(normalized, iso))
                processed = self._transliterator.transliterate(processed, iso, "hi")
                processed = processed.replace(" \u094d ", "\u094d")
            output.append(processed if is_target else f"{src_lang} {tgt_lang} {processed}")
        return output

    def postprocess_batch(self, sentences, lang="hin_Deva", **_kwargs):
        iso = self._iso_codes.get(lang)
        if not iso:
            raise ValueError("Unsupported IndicTrans2 language tag")
        output = []
        for sentence in sentences:
            if isinstance(sentence, (tuple, list)):
                sentence = sentence[0]
            if iso == "en":
                output.append(self._en_detokenizer.detokenize(sentence.split(" ")))
            else:
                target_script = self._transliterator.transliterate(sentence, "hi", iso)
                output.append(indic_detokenize.trivial_detokenize(target_script, iso))
        return output
