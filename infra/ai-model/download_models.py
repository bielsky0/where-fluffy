"""Wypieka wagi obu modeli w obraz Dockera na etapie budowy (odpowiednik dawnego `ollama pull`
z poprzedniej wersji tego serwisu) — kontener jest gotowy serwować embeddingi od pierwszego
bootu, bez runtime'owego pobierania, na które ai-worker musiałby czekać przez healthcheck."""

from main import load_text_model, load_vision_model

load_text_model()
load_vision_model()
print("modele nomic (text + vision) pobrane do cache HF i zwalidowane")
