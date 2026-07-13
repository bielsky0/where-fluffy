"""Sidecar embeddingów — zastępuje Ollamę jako serwis `ai-model` w docker-compose.yml.

Serwuje OBIE wieże rodziny nomic v1.5, bo są wyrównane (aligned) w tej samej przestrzeni 768 dim:
- POST /embed/text  -> nomic-embed-text-v1.5   (query-time, moduł search; prefiks "search_query: ")
- POST /embed/image -> nomic-embed-vision-v1.5 (write-time, ai-worker; max 5 zdjęć -> JEDEN wektor)

Dzięki wyrównaniu przestrzeni tekstowe zapytanie użytkownika dopasowuje się cross-modalnie do
czysto wizualnych wektorów zdjęć zapisanych w Pet.embedding. CPU-only, wagi wypiekane w obraz na
etapie budowy (download_models.py), zero płatnych API stron trzecich.
"""

import asyncio
import io
import os
from contextlib import asynccontextmanager

import httpx
import torch
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from PIL import Image
from pydantic import BaseModel, Field

from vector_math import assert_unit_norm, l2_normalize, mean_pool

TEXT_MODEL_ID = "nomic-ai/nomic-embed-text-v1.5"
VISION_MODEL_ID = "nomic-ai/nomic-embed-vision-v1.5"

# Wieże nomic v1.5 są trenowane kontrastywnie z prefiksami zadań — zapytanie tekstowe MUSI dostać
# "search_query: ", inaczej ląduje w złym rejonie wspólnej przestrzeni i ranking się psuje.
# Prefiks doklejamy tutaj (nie w Node), bo jedynym konsumentem /embed/text jest query-time search.
SEARCH_QUERY_PREFIX = "search_query: "

# Musi zgadzać się z MAX_EMBED_PHOTOS w src/ai-worker/embed-pet-data.processor.ts.
MAX_IMAGES_PER_REQUEST = 5
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Agresywne timeouty pobierania: zawieszony serwer zdjęć ma dać szybkie 422 (retry robi BullMQ),
# a nie blokować sidecar — i pośrednio całą kolejkę embeddingów.
DOWNLOAD_TIMEOUT = httpx.Timeout(5.0, connect=2.0)

# Pojedynczy proces Uvicorna + semafor zamiast wielu workerów Gunicorna: każdy dodatkowy worker
# zdublowałby oba modele w RAM (limit 2G w compose). Nadmiarowe requesty (np. skok z backfillu)
# czekają w kolejce asyncio zamiast puchnąć w pamięci jako równoległe inferencje.
INFERENCE_CONCURRENCY = 2


def load_text_model():
    # Import lazy, żeby testy z fake'ami nie płaciły za start sentence-transformers.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(TEXT_MODEL_ID, trust_remote_code=True)


def load_vision_model():
    from transformers import AutoImageProcessor, AutoModel

    processor = AutoImageProcessor.from_pretrained(VISION_MODEL_ID)
    model = AutoModel.from_pretrained(VISION_MODEL_ID, trust_remote_code=True)
    model.eval()
    return processor, model


class EmbedTextRequest(BaseModel):
    text: str = Field(min_length=1)


class EmbedImageRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=MAX_IMAGES_PER_REQUEST)


class EmbedResponse(BaseModel):
    embedding: list[float]


async def download_image(client: httpx.AsyncClient, url: str) -> Image.Image:
    try:
        async with client.stream("GET", url, timeout=DOWNLOAD_TIMEOUT) as response:
            response.raise_for_status()
            buffer = bytearray()
            async for chunk in response.aiter_bytes():
                buffer.extend(chunk)
                # Limit sprawdzany strumieniowo — złośliwie wielki plik nie zapełni RAM-u.
                if len(buffer) > MAX_IMAGE_BYTES:
                    raise HTTPException(
                        status_code=422,
                        detail=f"obraz przekracza limit {MAX_IMAGE_BYTES} bajtów: {url}",
                    )
    except HTTPException:
        raise
    except httpx.HTTPError as err:
        raise HTTPException(status_code=422, detail=f"nie udało się pobrać obrazu {url}: {err}") from err

    try:
        return Image.open(io.BytesIO(bytes(buffer))).convert("RGB")
    except Exception as err:
        raise HTTPException(status_code=422, detail=f"nie udało się zdekodować obrazu {url}: {err}") from err


def create_app(text_model=None, vision_model=None, image_processor=None) -> FastAPI:
    """Fake'i w testach wchodzą przez parametry; produkcyjnie modele ładują się w lifespan
    (start kontenera) z cache HF wypieczonego w obraz — bez pobierania niczego w runtime."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Przypięte do limitu cpus serwisu ai-model w docker-compose.yml.
        torch.set_num_threads(int(os.environ.get("TORCH_NUM_THREADS", "2")))
        app.state.text_model = text_model if text_model is not None else await run_in_threadpool(load_text_model)
        if vision_model is not None and image_processor is not None:
            app.state.vision_model = vision_model
            app.state.image_processor = image_processor
        else:
            app.state.image_processor, app.state.vision_model = await run_in_threadpool(load_vision_model)
        app.state.http_client = httpx.AsyncClient(follow_redirects=True)
        app.state.inference_semaphore = asyncio.Semaphore(INFERENCE_CONCURRENCY)
        yield
        await app.state.http_client.aclose()

    app = FastAPI(lifespan=lifespan)

    def embed_text_sync(text: str) -> list[float]:
        raw = app.state.text_model.encode(SEARCH_QUERY_PREFIX + text)
        return l2_normalize([float(v) for v in raw])

    def embed_images_sync(images: list[Image.Image]) -> list[float]:
        inputs = app.state.image_processor(images, return_tensors="pt")
        with torch.no_grad():
            outputs = app.state.vision_model(**inputs).last_hidden_state
        # Token CLS ([:, 0]) jako embedding obrazu — zgodnie z kartą modelu nomic-embed-vision.
        per_image = [l2_normalize([float(v) for v in row]) for row in outputs[:, 0]]
        return l2_normalize(mean_pool(per_image))

    @app.get("/health")
    async def health():
        # Lifespan ładuje modele przed przyjęciem pierwszego requesta, więc samo odpowiadanie
        # tego endpointu oznacza "modele w pamięci, gotowe do inferencji".
        return {"status": "ok"}

    @app.post("/embed/text", response_model=EmbedResponse)
    async def embed_text(payload: EmbedTextRequest) -> EmbedResponse:
        async with app.state.inference_semaphore:
            embedding = await run_in_threadpool(embed_text_sync, payload.text)
        assert_unit_norm(embedding)
        return EmbedResponse(embedding=embedding)

    @app.post("/embed/image", response_model=EmbedResponse)
    async def embed_image(payload: EmbedImageRequest) -> EmbedResponse:
        # Pobieranie równoległe i POZA semaforem — sieć nie blokuje slotów inferencji.
        images = await asyncio.gather(
            *(download_image(app.state.http_client, url) for url in payload.urls)
        )
        async with app.state.inference_semaphore:
            embedding = await run_in_threadpool(embed_images_sync, images)
        assert_unit_norm(embedding)
        return EmbedResponse(embedding=embedding)

    return app


app = create_app()
