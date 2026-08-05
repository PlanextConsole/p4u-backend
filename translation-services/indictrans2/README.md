# P4U IndicTrans2 service

Self-hosted translation for Socio chat. It uses AI4Bharat IndicTrans2 models and requires no paid translation API key. The first run downloads model weights; production should mount a persistent Hugging Face cache and preferably use a CUDA GPU.

```powershell
cd "C:\Users\ADMIN\Desktop\P4U- NEW\p4u-backend\translation-services\indictrans2"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8091
```

Set `INDICTRANS2_SERVICE_URL=http://localhost:8091` in the Socio service environment. Translation results are cached by message ID and target language in the Socio database.

Alternatively, from `p4u-backend` run:

```powershell
docker compose --profile translation up --build indictrans2
```
