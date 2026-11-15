"""Palet warna bersama (data/palet.json) untuk ubin PNG. Dipakai juga oleh aplikasi untuk legenda."""

from __future__ import annotations

import json

import numpy as np
from PIL import Image

import gibs

PALET = json.loads((gibs.AKAR / "data" / "palet.json").read_text(encoding="utf-8"))
TINGKAT = 255  # indeks 1..255; indeks 0 = transparan


def _ramp(titik: list, n: int) -> tuple[np.ndarray, float, float]:
    """n warna RGBA yang diinterpolasi linear di skala log10 nilai."""
    x = np.log10([t[0] for t in titik])
    warna = np.array([t[1] for t in titik], dtype=np.float64)
    pos = np.linspace(x[0], x[-1], n)
    rgba = np.stack([np.interp(pos, x, warna[:, c]) for c in range(4)], axis=1)
    return np.round(rgba).astype(np.uint8), float(x[0]), float(x[-1])


_CAHAYA, _C0, _C1 = _ramp(PALET["cahaya"], TINGKAT)
_NAIK, _S0, _S1 = _ramp(PALET["selisih"]["naik"], 127)
_TURUN, _, _ = _ramp(PALET["selisih"]["turun"], 127)


def _simpan(indeks: np.ndarray, rgba: np.ndarray, berkas) -> None:
    im = Image.fromarray(indeks, mode="P")
    palet = np.zeros((256, 3), dtype=np.uint8)
    alfa = np.zeros(256, dtype=np.uint8)
    palet[1 : 1 + len(rgba)] = rgba[:, :3]
    alfa[1 : 1 + len(rgba)] = rgba[:, 3]
    im.putpalette(palet.tobytes())
    im.save(berkas, format="PNG", optimize=True, transparency=alfa.tobytes())


def indeks_cahaya(radiance: np.ndarray) -> np.ndarray:
    """Radiance -> indeks palet 0..255 (0 = di bawah ambang tampil atau tanpa data)."""
    r = np.nan_to_num(radiance.astype(np.float32), nan=0.0)
    with np.errstate(divide="ignore"):
        t = (np.log10(np.maximum(r, 1e-6)) - _C0) / (_C1 - _C0)
    idx = np.clip(np.round(t * (TINGKAT - 1)), 0, TINGKAT - 1).astype(np.uint8) + 1
    idx[r < 10**_C0] = 0
    return idx


def simpan_cahaya(radiance: np.ndarray, berkas) -> None:
    _simpan(indeks_cahaya(radiance), _CAHAYA, berkas)


def indeks_selisih(selisih: np.ndarray) -> np.ndarray:
    """Selisih radiance -> indeks: 1..127 naik, 128..254 turun, 0 = nyaris tidak berubah."""
    d = np.nan_to_num(selisih.astype(np.float32), nan=0.0)
    besar = np.abs(d)
    with np.errstate(divide="ignore"):
        t = (np.log10(np.maximum(besar, 1e-6)) - _S0) / (_S1 - _S0)
    tingkat = np.clip(np.round(t * 126), 0, 126).astype(np.uint8)
    idx = np.where(d > 0, tingkat + 1, tingkat + 128).astype(np.uint8)
    idx[besar < 10**_S0] = 0
    return idx


def simpan_selisih(selisih: np.ndarray, berkas) -> None:
    _simpan(indeks_selisih(selisih), np.concatenate([_NAIK, _TURUN]), berkas)
