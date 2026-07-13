"""Testy kontraktu API na fake'owych modelach (bez wag, bez sieci) — pilnują przede wszystkim
tego, że KAŻDY wektor opuszczający sidecar jest jednostkowy, że prefiks `search_query: ` jest
doklejany po stronie serwera i że limity pobierania obrazów faktycznie działają."""

import asyncio
import math

import httpx
import pytest
import torch
from fastapi.testclient import TestClient

import main
from main import MAX_IMAGE_BYTES, SEARCH_QUERY_PREFIX, create_app, download_image


class FakeTextModel:
    def __init__(self):
        self.seen: list[str] = []

    def encode(self, text: str):
        self.seen.append(text)
        return [3.0, 4.0]  # norma 5 -> po normalizacji [0.6, 0.8]


class FakeVisionOutput:
    def __init__(self, last_hidden_state):
        self.last_hidden_state = last_hidden_state


class FakeVisionModel:
    def __call__(self, **inputs):
        count = int(inputs["pixel_values"].shape[0])
        # Każdy obraz dostaje CLS = [2, 0] -> per-obraz normalizacja, mean-pool i finalna
        # normalizacja muszą dać dokładnie [1, 0].
        cls_tokens = torch.tensor([[2.0, 0.0]] * count)
        return FakeVisionOutput(cls_tokens.unsqueeze(1))  # kształt (n, 1, 2)


class FakeImageProcessor:
    def __call__(self, images, return_tensors):
        assert return_tensors == "pt"
        return {"pixel_values": torch.zeros((len(images), 3, 2, 2))}


@pytest.fixture()
def client():
    app = create_app(
        text_model=FakeTextModel(),
        vision_model=FakeVisionModel(),
        image_processor=FakeImageProcessor(),
    )
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_embed_text_dokleja_prefiks_i_normalizuje(client):
    response = client.post("/embed/text", json={"text": "czarny kot"})
    assert response.status_code == 200
    embedding = response.json()["embedding"]
    assert embedding == pytest.approx([0.6, 0.8])
    assert client.app.state.text_model.seen == [f"{SEARCH_QUERY_PREFIX}czarny kot"]


def test_embed_image_pooluje_do_jednego_wektora_jednostkowego(client, monkeypatch):
    async def fake_download(http_client, url):
        return object()  # FakeImageProcessor patrzy tylko na liczbę "obrazów"

    monkeypatch.setattr(main, "download_image", fake_download)
    response = client.post(
        "/embed/image",
        json={"urls": ["http://x/1.jpg", "http://x/2.jpg", "http://x/3.jpg"]},
    )
    assert response.status_code == 200
    embedding = response.json()["embedding"]
    assert embedding == pytest.approx([1.0, 0.0])
    assert math.sqrt(sum(v * v for v in embedding)) == pytest.approx(1.0)


def test_embed_image_odrzuca_wiecej_niz_piec_urli(client):
    response = client.post("/embed/image", json={"urls": [f"http://x/{i}.jpg" for i in range(6)]})
    assert response.status_code == 422


def test_download_image_odrzuca_za_duzy_plik():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, content=b"x" * (MAX_IMAGE_BYTES + 1))
    )

    async def run():
        async with httpx.AsyncClient(transport=transport) as http_client:
            await download_image(http_client, "http://x/duzy.jpg")

    with pytest.raises(Exception) as excinfo:
        asyncio.run(run())
    assert getattr(excinfo.value, "status_code", None) == 422


def test_download_image_mapuje_blad_http_na_422():
    transport = httpx.MockTransport(lambda request: httpx.Response(404))

    async def run():
        async with httpx.AsyncClient(transport=transport) as http_client:
            await download_image(http_client, "http://x/brak.jpg")

    with pytest.raises(Exception) as excinfo:
        asyncio.run(run())
    assert getattr(excinfo.value, "status_code", None) == 422
