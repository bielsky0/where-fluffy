"""Jedyne źródło prawdy dla matematyki wektorów w całym pipeline embeddingów.

Node celowo NIE wykonuje żadnej arytmetyki na wektorach (patrz ai-worker/embed-pet-data.processor.ts
i search.service.ts — obie strony tylko przekazują gotowe wektory dalej). Normalizacja L2 i
mean-pooling żyją wyłącznie tutaj i są używane przez oba endpointy (/embed/text i /embed/image).
Dzięki temu nie ma ryzyka, że jedna modalność zapisze do pgvector wektor znormalizowany, a druga
surowy — wtedy podobieństwo cosinusowe (operator <=>) między nimi byłoby systematycznie przekłamane.
"""

import math


def l2_normalize(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(v * v for v in vector))
    if magnitude == 0.0:
        # Wektor zerowy z prawdziwego modelu oznacza, że coś jest fundamentalnie zepsute —
        # lepiej głośno paść (500/retry BullMQ) niż zapisać do bazy śmieciowy embedding.
        raise ValueError("nie można znormalizować wektora zerowego")
    return [v / magnitude for v in vector]


def mean_pool(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        raise ValueError("mean_pool wymaga co najmniej jednego wektora")
    dimensions = len(vectors[0])
    if any(len(v) != dimensions for v in vectors):
        raise ValueError("wszystkie wektory muszą mieć tę samą liczbę wymiarów")
    return [sum(v[i] for v in vectors) / len(vectors) for i in range(dimensions)]


def assert_unit_norm(vector: list[float], tolerance: float = 1e-3) -> None:
    """Defensywny bezpiecznik kontraktu API: każdy wektor opuszczający sidecar ma długość 1."""
    magnitude = math.sqrt(sum(v * v for v in vector))
    if abs(magnitude - 1.0) > tolerance:
        raise RuntimeError(f"kontrakt API złamany: ||v|| = {magnitude}, oczekiwano 1.0")
