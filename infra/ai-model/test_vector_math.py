import math

import pytest

from vector_math import assert_unit_norm, l2_normalize, mean_pool


def norm(vector: list[float]) -> float:
    return math.sqrt(sum(v * v for v in vector))


def test_l2_normalize_daje_wektor_jednostkowy():
    assert l2_normalize([3.0, 4.0]) == [0.6, 0.8]
    assert norm(l2_normalize([0.1, -7.0, 2.5])) == pytest.approx(1.0)


def test_l2_normalize_odrzuca_wektor_zerowy():
    with pytest.raises(ValueError):
        l2_normalize([0.0, 0.0, 0.0])


def test_mean_pool_usrednia_po_wspolrzednych():
    assert mean_pool([[1.0, 3.0], [3.0, 5.0]]) == [2.0, 4.0]


def test_mean_pool_odrzuca_pusta_liste_i_rozne_dlugosci():
    with pytest.raises(ValueError):
        mean_pool([])
    with pytest.raises(ValueError):
        mean_pool([[1.0, 2.0], [1.0]])


def test_assert_unit_norm_pilnuje_kontraktu():
    assert_unit_norm([0.6, 0.8])  # nie rzuca
    with pytest.raises(RuntimeError):
        assert_unit_norm([3.0, 4.0])
