# P4U IndicTrans2 service

Self-hosted translation for Socio chat. It uses AI4Bharat IndicTrans2 models and requires no paid translation API key. The first run downloads model weights; production should mount a persistent Hugging Face cache and preferably use a CUDA GPU.

The official AI4Bharat model repositories are license-gated. Accept the model terms once on Hugging Face and set `HF_TOKEN` while downloading. After the weights are cached locally, normal translation does not consume a paid API and can run offline.

```powershell
cd "C:\Users\ADMIN\Desktop\P4U- NEW\p4u-backend\translation-services\indictrans2"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8091
```

For the workspace-local portable Windows runtime installed for this project:

```powershell
$env:HF_TOKEN="your_hugging_face_read_token"
.\run-local.ps1
```

Set `INDICTRANS2_SERVICE_URL=http://localhost:8091` in the Socio service environment. Translation results are cached by message ID and target language in the Socio database.

Alternatively, from `p4u-backend` run:

```powershell
docker compose --profile translation up --build indictrans2
```
