# Sidecar embeddingów (FastAPI + nomic v1.5 text/vision) — zastąpił Ollamę, która nie umie
# embedować obrazów. Wagi wypiekane w obraz na etapie budowy (jak dawne `ollama pull` w
# poprzedniej wersji tego pliku) — wolniejszy build, ale kontener serwuje embeddingi natychmiast
# po starcie, bez runtime'owego pobierania, na które ai-worker musiałby czekać przez
# healthcheck-gated depends_on.
FROM python:3.12-slim

# curl dla healthchecka serwisu ai-model w docker-compose.yml.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/opt/hf-cache \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
# --extra-index-url: wheels torcha CPU-only — bez tego pip ciągnie wielogigabajtowy wariant CUDA.
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

COPY vector_math.py main.py download_models.py test_vector_math.py test_api.py ./

# Testy kontraktu (||v|| == 1, prefiks search_query, limity pobierania) na etapie budowy — ten
# katalog nie przechodzi przez Node'owe `npm test`, więc build obrazu jest jego bramką CI.
RUN python -m pytest -q

RUN python download_models.py

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
