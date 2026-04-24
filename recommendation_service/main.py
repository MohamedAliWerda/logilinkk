# -*- coding: utf-8 -*-
"""
Recommendation Service — ISGIS
FastAPI micro-service qui :
  1) lit cv_submissions + cv_matching_competence_results (Supabase REST)
  2) agrege les gaps (TARGET_METIER / OTHER_METIER, niveau de priorite)
    3) effectue un retrieval RAG simple (embedding lexical) sur RAG_MASTER_v3_FINAL_enriched.xlsx
  4) appelle Gemini pour produire la reco structuree (RAG-only fallback si KO)
  5) insere les recommandations (status=pending) + targets dans Supabase
  6) expose POST /generate, GET /status/{job_id}, GET /health

Declenche par le backend NestJS quand l'admin clique sur "Generer".
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
import time
import unicodedata
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


LOGGER = logging.getLogger("recommendation_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# =============================================================================
# Configuration (env d'abord, valeurs par defaut en dur - partagees avec Colab)
# =============================================================================

SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://kayhpmwnerluxfuaalmg.supabase.co",
).rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtheWhwbXduZXJsdXhmdWFhbG1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzczNTkxMiwiZXhwIjoyMDg5MzExOTEyfQ."
    "A5kQ2sDy5r-EMUSUllPr7OrcyTuz7Z3LXcRNs14I0qo",
)
# Gemini (seul provider LLM)
GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY",
    "AIzaSyDRMWPJ0OcgR7DpE1bi3ku04IesJyFM85A",
)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_RATE_LIMIT_SLEEP = float(os.getenv("GEMINI_RATE_LIMIT_SLEEP", "0.15"))

RAG_XLSX_PATH = os.getenv(
    "RAG_XLSX_PATH",
    str(Path(__file__).parent / "RAG_MASTER_v3_FINAL_enriched.xlsx"),
)

EMBED_DIM = 384
TOP_K_RAG = int(os.getenv("TOP_K_RAG", "5"))
# Optional hard cap on LLM calls per job (0 = unlimited). Useful pour economiser le quota Gemini.
MAX_LLM_CALLS = int(os.getenv("MAX_LLM_CALLS", "0"))

# Seuils priorite sur % cohorte
PRIORITY_THRESHOLDS = {"CRITIQUE": 70, "HAUTE": 40, "MOYENNE": 20, "FAIBLE": 0}


# =============================================================================
# Supabase REST helpers
# =============================================================================

def _supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _sanitize_json_value(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, dict):
        return {str(k): _sanitize_json_value(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_sanitize_json_value(v) for v in value]

    if isinstance(value, np.generic):
        return _sanitize_json_value(value.item())

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    return value


def _serialize_json_payload(payload: Any) -> str:
    sanitized = _sanitize_json_value(payload)
    try:
        return json.dumps(sanitized, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Invalid JSON payload for Supabase: {exc}") from exc


def supabase_select(table: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Page through a PostgREST select so we avoid the default 1000-row cap."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    base_params = dict(params or {})
    rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0

    with httpx.Client(timeout=60.0) as client:
        while True:
            headers = _supabase_headers()
            headers["Range-Unit"] = "items"
            headers["Range"] = f"{offset}-{offset + page_size - 1}"
            resp = client.get(url, params=base_params, headers=headers)
            if resp.status_code >= 400:
                raise RuntimeError(f"Supabase SELECT {table} failed: {resp.status_code} {resp.text}")
            batch = resp.json() or []
            rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size

    return rows


def supabase_upsert(table: str, rows: list[dict[str, Any]], on_conflict: str | None = None) -> None:
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params: dict[str, Any] = {}
    if on_conflict:
        params["on_conflict"] = on_conflict

    headers = _supabase_headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"

    with httpx.Client(timeout=120.0) as client:
        # Chunk to avoid huge payloads
        for i in range(0, len(rows), 500):
            chunk = rows[i : i + 500]
            payload = _serialize_json_payload(chunk)
            resp = client.post(url, params=params, content=payload, headers=headers)
            if resp.status_code >= 400:
                raise RuntimeError(f"Supabase UPSERT {table} failed: {resp.status_code} {resp.text}")


def supabase_patch(table: str, match: dict[str, str], patch: dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {k: f"eq.{v}" for k, v in match.items()}
    payload = _serialize_json_payload(patch)
    with httpx.Client(timeout=30.0) as client:
        resp = client.patch(url, params=params, content=payload, headers=_supabase_headers())
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase PATCH {table} failed: {resp.status_code} {resp.text}")


def supabase_delete(table: str, match: dict[str, str]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {k: f"eq.{v}" for k, v in match.items()}
    with httpx.Client(timeout=30.0) as client:
        resp = client.delete(url, params=params, headers=_supabase_headers())
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase DELETE {table} failed: {resp.status_code} {resp.text}")


def get_recommendation_status_map(recommendation_ids: list[str]) -> dict[str, str]:
    """Return current status per recommendation id from ai_recommendations."""
    if not recommendation_ids:
        return {}

    status_map: dict[str, str] = {}
    # Keep chunks small enough for query-string limits.
    for i in range(0, len(recommendation_ids), 200):
        chunk = [rid for rid in recommendation_ids[i : i + 200] if rid]
        if not chunk:
            continue

        rows = supabase_select(
            "ai_recommendations",
            {
                "select": "id,status",
                "id": f"in.({','.join(chunk)})",
            },
        )
        for row in rows:
            rid = str(row.get("id") or "").strip()
            if rid:
                status_map[rid] = str(row.get("status") or "").strip().lower()

    return status_map


# =============================================================================
# Lexical embedding (no HuggingFace / no model download)
# =============================================================================

_TOKEN_RE = re.compile(r"[a-z0-9_]{2,}")


def _normalize(text: Any) -> str:
    s = str(text or "").strip().lower()
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", s).strip()


def embed_texts(texts: list[str], dim: int = EMBED_DIM) -> np.ndarray:
    vectors = np.zeros((len(texts), dim), dtype=np.float32)
    for i, raw in enumerate(texts):
        tokens = _TOKEN_RE.findall(_normalize(raw))
        if not tokens:
            continue
        for tok in tokens:
            vectors[i, hash(tok) % dim] += 1.0
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    np.divide(vectors, np.maximum(norms, 1e-9), out=vectors)
    return vectors


# =============================================================================
# RAG corpus (lazy singleton)
# =============================================================================

_RAG_CACHE: dict[str, Any] = {"docs": None, "vectors": None, "loaded_at": None}
_RAG_LOCK = threading.Lock()


SHEET_CONFIGS = {
    "8-Ressources Formation": {
        "fmt": lambda r: f"[CERTIF] {r.get('Titre','')} | Plateforme: {r.get('Plateforme','')} | Duree: {r.get('Duree','')}h | Competences: {r.get('Competences','')} | Pour: {r.get('Recommande Pour','')}",
        "titre_col": ["Titre"],
    },
    "9-RNCP": {
        "fmt": lambda r: f"[RNCP] {r.get('Certification','')} | Metier: {r.get('Metier','')} | Competences: {r.get('Competences','')} | Mots-cles: {r.get('Mots-cles','')}",
        "titre_col": ["Certification"],
    },
    "11-AFT": {
        "fmt": lambda r: f"[AFT] {r.get('Titre','')} | Metier: {r.get('Metier','')} | Certif: {r.get('Certifications','')} | Mots-cles: {r.get('Mots-cles','')}",
        "titre_col": ["Titre"],
    },
    "19-Frequence Gaps TN": {
        "fmt": lambda r: f"[GAP_TN] {r.get('Gap','')} | Criticite: {r.get('Criticite','')} | Ressource: {r.get('Ressource','')} | Duree: {r.get('Duree','')}",
        "titre_col": ["Gap"],
    },
    "20-Regles Recommandation": {
        "fmt": lambda r: f"[REGLE] {r.get('Condition','')} | Priorite: {r.get('Priorite','')} | Action: {r.get('Action','')} | {r.get('Message Admin','')}",
        "titre_col": ["Condition"],
    },
    "7-Comp Transversales": {
        "fmt": lambda r: f"[TRANSV] {r.get('Competence FR','')} | Freq: {r.get('Frequence','')} | Formation: {r.get('Formation','')} | Ressources: {r.get('Ressources Gratuites','')}",
        "titre_col": ["Competence FR"],
    },
    "23-Comp Emergentes": {
        "fmt": lambda r: f"[EMERGENT] {r.get('Competence','')} | Tendance: {r.get('Tendance','')} | Formation: {r.get('Formation','')} | Outils: {r.get('Outils','')}",
        "titre_col": ["Competence"],
    },
}


def _get_titre(row: dict[str, Any], cols: list[str]) -> str:
    for c in cols:
        v = row.get(c, "")
        if v and str(v).strip():
            return str(v).strip()
    return "N/A"


def _load_rag_corpus() -> tuple[list[dict[str, Any]], np.ndarray]:
    path = Path(RAG_XLSX_PATH)
    if not path.exists():
        LOGGER.warning("RAG file not found at %s — retrieval will return empty.", path)
        return [], np.zeros((0, EMBED_DIM), dtype=np.float32)

    docs: list[dict[str, Any]] = []
    for sheet, cfg in SHEET_CONFIGS.items():
        try:
            df = pd.read_excel(path, sheet_name=sheet)
        except Exception as exc:
            LOGGER.warning("RAG sheet %s skipped: %s", sheet, exc)
            continue
        for _, row in df.iterrows():
            r = row.to_dict()
            text = cfg["fmt"](r)
            if len(str(text).strip()) <= 10:
                continue
            docs.append({
                "text": str(text),
                "source": sheet,
                "titre": _get_titre(r, cfg["titre_col"]),
            })

    if not docs:
        return [], np.zeros((0, EMBED_DIM), dtype=np.float32)

    vectors = embed_texts([d["text"] for d in docs])
    LOGGER.info("RAG corpus loaded: %d docs.", len(docs))
    return docs, vectors


def get_rag_corpus() -> tuple[list[dict[str, Any]], np.ndarray]:
    with _RAG_LOCK:
        if _RAG_CACHE["docs"] is None:
            docs, vecs = _load_rag_corpus()
            _RAG_CACHE["docs"] = docs
            _RAG_CACHE["vectors"] = vecs
            _RAG_CACHE["loaded_at"] = datetime.now(timezone.utc).isoformat()
        return _RAG_CACHE["docs"], _RAG_CACHE["vectors"]


def retrieve(query: str, k: int = TOP_K_RAG) -> list[dict[str, Any]]:
    docs, vectors = get_rag_corpus()
    if not docs:
        return []
    q_vec = embed_texts([query])[0]
    sims = vectors @ q_vec
    top_idx = np.argsort(-sims)[:k]
    return [
        {**docs[int(i)], "score": float(sims[int(i)])}
        for i in top_idx
        if sims[int(i)] > 0
    ]


# =============================================================================
# LLM (Gemini)
# =============================================================================

SYSTEM_PROMPT = (
    "Tu es un conseiller pedagogique expert de l'ISGIS Sfax (Tunisie). "
    "Tu analyses les gaps de competences des etudiants et recommandes UNE formation certifiante precise pour combler le gap. "
    "Tu reponds en francais, en JSON strict, sans texte avant ou apres le JSON. "
    "Tu utilises EXCLUSIVEMENT les ressources fournies dans le contexte RAG pour le nom de la certification (cert_title) et son fournisseur (cert_provider)."
)


class LLMDailyCapExhausted(Exception):
    """Raised when a provider has hit its daily quota - retrying is futile."""


_RETRY_AFTER_RE = re.compile(r"try again in ([0-9]+)m([0-9.]+)s", re.IGNORECASE)
_RETRY_AFTER_SEC_RE = re.compile(r"try again in ([0-9.]+)s", re.IGNORECASE)


def _extract_retry_after_seconds(err_msg: str) -> float:
    m = _RETRY_AFTER_RE.search(err_msg)
    if m:
        return float(m.group(1)) * 60 + float(m.group(2))
    m = _RETRY_AFTER_SEC_RE.search(err_msg)
    if m:
        return float(m.group(1))
    return 0.0


def _base_fallback(gap: dict[str, Any]) -> dict[str, Any]:
    return {
        "cert_title": "A definir",
        "cert_provider": "",
        "cert_duration": "",
        "cert_pricing": "",
        "cert_url": "",
        "cert_description": "",
        "llm_recommendation": "",
        "gap_label": (gap["competence_name"] or "")[:60],
        "gap_title": (gap["competence_name"] or "")[:100],
    }


def _build_prompt(gap: dict[str, Any], rag_results: list[dict[str, Any]]) -> str:
    ctx = "\n".join(f"- [{r['source']}] {r['text'][:280]}" for r in rag_results[:4]) or "(pas de ressource RAG disponible)"
    bucket_hint = (
        "Metier VISE par l'etudiant - priorite tres haute."
        if gap["bucket"] == "TARGET_METIER"
        else "Metier connexe - recommandation pour elargir l'employabilite."
    )
    return f"""CONTEXTE DU GAP :
- Bucket : {gap['bucket']} ({bucket_hint})
- Metier : {gap['metier_name']}
- Domaine : {gap['domaine_name']}
- Competence manquante : {gap['competence_name']}
- Type : {gap['competence_type']}
- Mots-cles : {gap['keywords']}
- Etudiants concernes : {gap['n_students']} / {gap['cohort_size']} ({gap['pct']}%)
- Priorite calculee : {gap['priority']}
- Rang popularite metier : #{gap['popularity_rank']}
- Score similarite moyen : {gap['avg_similarity']:.3f}

RESSOURCES DISPONIBLES (RAG) :
{ctx}

Reponds UNIQUEMENT avec ce JSON :
{{
  "cert_title": "Nom EXACT de la certification recommandee (tire du RAG)",
  "cert_provider": "Plateforme/organisme (tire du RAG)",
  "cert_duration": "Duree (ex: '40h', '3 mois')",
  "cert_pricing": "Tarif (ex: 'Gratuit', '150 TND')",
  "cert_url": "URL si disponible sinon ''",
  "cert_description": "1 phrase decrivant la certif",
  "llm_recommendation": "Recommandation pedagogique en 3-4 lignes : constat + justification + action",
  "gap_label": "Libelle court du gap (max 60 car.)",
  "gap_title": "Titre descriptif du gap (max 100 car.)"
}}"""


# -----------------------------------------------------------------------------
# Provider: Gemini (direct REST, no SDK dependency)
# -----------------------------------------------------------------------------

def _call_gemini(gap: dict[str, Any], rag_results: list[dict[str, Any]]) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise RuntimeError("gemini api key unavailable")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    user_msg = _build_prompt(gap, rag_results)
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_msg}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 600,
            "responseMimeType": "application/json",
        },
    }

    max_attempts = 3
    last_err: Optional[str] = None
    for attempt in range(1, max_attempts + 1):
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, json=body, headers={"Content-Type": "application/json"})
            if resp.status_code == 429:
                text = resp.text
                if "per day" in text.lower() or "quota" in text.lower():
                    raise LLMDailyCapExhausted(f"gemini: {text[:300]}")
                if attempt < max_attempts:
                    wait = min(_extract_retry_after_seconds(text) or (2 ** attempt), 15.0)
                    LOGGER.warning("Gemini rate-limited (%d/%d) - sleeping %.1fs", attempt, max_attempts, wait)
                    time.sleep(wait)
                    continue
                raise RuntimeError(f"gemini 429: {text[:200]}")
            if resp.status_code >= 400:
                raise RuntimeError(f"gemini {resp.status_code}: {resp.text[:200]}")

            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                raise RuntimeError(f"gemini empty response: {data}")
            parts = candidates[0].get("content", {}).get("parts") or []
            text_out = "".join(p.get("text", "") for p in parts).strip()
            return json.loads(text_out)
        except LLMDailyCapExhausted:
            raise
        except Exception as exc:
            last_err = str(exc)
            if attempt >= max_attempts:
                raise
            time.sleep(1.0)

    raise RuntimeError(last_err or "gemini unknown failure")


# -----------------------------------------------------------------------------
# Provider: pure-RAG fallback (no LLM)
# -----------------------------------------------------------------------------

_CERT_FIELD_RE = re.compile(r"([A-Za-zeE\- ]+):\s*([^|]+?)(?=\s*\||$)")


def _rag_only_recommendation(gap: dict[str, Any], rag_results: list[dict[str, Any]]) -> dict[str, Any]:
    out = _base_fallback(gap)

    # Prefer a certification-oriented hit: 8-Ressources Formation, 9-RNCP, 11-AFT, 23-Comp Emergentes
    priority_sources = {"8-Ressources Formation": 3, "9-RNCP": 2, "11-AFT": 2, "23-Comp Emergentes": 1}
    best = None
    for r in rag_results:
        weight = priority_sources.get(r.get("source", ""), 0)
        score = r.get("score", 0.0) + weight * 0.05
        if best is None or score > best["weighted"]:
            best = {**r, "weighted": score}

    if best:
        out["cert_title"] = best.get("titre") or "A definir"
        out["cert_description"] = best["text"][:240]
        # Try to peel out Plateforme / Duree from the flattened text line
        fields = dict(_CERT_FIELD_RE.findall(best["text"]))
        for src_key, target in (("Plateforme", "cert_provider"), ("Duree", "cert_duration")):
            if src_key in fields:
                out[target] = fields[src_key].strip()

    priority = gap.get("priority", "MOYENNE")
    pct = gap.get("pct", 0)
    metier = gap.get("metier_name", "")
    out["llm_recommendation"] = (
        f"[Mode RAG-only] Gap de priorite {priority} detecte sur '{gap['competence_name']}' "
        f"(metier: {metier}) touchant {pct}% de la cohorte. "
        f"Ressource la plus pertinente du referentiel : {out['cert_title']}. "
        f"Verification manuelle par l'admin recommandee."
    )
    return out


# -----------------------------------------------------------------------------
# Entry point: Gemini -> RAG-only fallback
# -----------------------------------------------------------------------------

def llm_recommend(gap: dict[str, Any], rag_results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Appelle Gemini pour produire la reco. En cas d'echec non-quota -> fallback RAG-only.
    Leve LLMDailyCapExhausted quand Gemini signale son cap journalier (le pipeline
    appelant arrete alors d'essayer le LLM pour les gaps suivants).
    """
    fallback = _base_fallback(gap)
    try:
        parsed = _call_gemini(gap, rag_results)
        return {**fallback, **parsed}
    except LLMDailyCapExhausted:
        raise
    except Exception as exc:
        LOGGER.warning("Gemini failed for '%s': %s - using RAG-only fallback", gap.get("competence_name"), exc)
        return _rag_only_recommendation(gap, rag_results)


# =============================================================================
# Pipeline
# =============================================================================

def priority_label(pct: float) -> str:
    if pct >= PRIORITY_THRESHOLDS["CRITIQUE"]:
        return "CRITIQUE"
    if pct >= PRIORITY_THRESHOLDS["HAUTE"]:
        return "HAUTE"
    if pct >= PRIORITY_THRESHOLDS["MOYENNE"]:
        return "MOYENNE"
    return "FAIBLE"


def build_recommendation_id(bucket: str, metier: str, competence: str) -> str:
    h = hashlib.sha256(f"{bucket}|{metier}|{competence}".encode("utf-8")).hexdigest()[:16]
    return f"rec_{h}"


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_and_aggregate_gaps() -> tuple[pd.DataFrame, int]:
    """Lit les deux tables Supabase et retourne le dataframe agrege."""
    submissions = supabase_select(
        "cv_submissions",
        {"select": "id,auth_id,metier_id,professional_title"},
    )
    results = supabase_select(
        "cv_matching_competence_results",
        {"select": "cv_submission_id,auth_id,metier_name,domaine_name,metier_rank,status,competence_name,competence_type,keywords,similarity_score"},
    )

    if not submissions:
        raise RuntimeError("cv_submissions est vide - rien a recommander.")
    if not results:
        raise RuntimeError("cv_matching_competence_results est vide - lance l'analyse de matching d'abord.")

    df_sub = pd.DataFrame(submissions).rename(
        columns={"id": "cv_submission_id", "metier_id": "target_metier_id", "professional_title": "target_metier_name"},
    )[["cv_submission_id", "auth_id", "target_metier_id", "target_metier_name"]]

    df_res = pd.DataFrame(results)

    df = df_res.merge(df_sub, on=["cv_submission_id", "auth_id"], how="left")
    df = df.dropna(subset=["target_metier_name"])
    df["is_target_metier"] = df["metier_name"] == df["target_metier_name"]

    df_gaps = df[df["status"] == "gap"].copy()
    if df_gaps.empty:
        return pd.DataFrame(), 0

    n_students = int(df_gaps["auth_id"].nunique())

    # Popularite du metier vise
    popularity = (
        df_sub.dropna(subset=["target_metier_name"])
        .groupby(["target_metier_id", "target_metier_name"])
        .size()
        .reset_index(name="n_students")
        .sort_values("n_students", ascending=False)
        .reset_index(drop=True)
    )
    popularity["rank"] = popularity.index + 1
    rank_map = dict(zip(popularity["target_metier_name"], popularity["rank"]))
    cohort_map = dict(zip(popularity["target_metier_name"], popularity["n_students"]))

    group_cols = ["metier_name", "domaine_name", "competence_name", "competence_type", "keywords"]
    df_gaps["similarity_score"] = df_gaps["similarity_score"].apply(_to_float)

    df_target = df_gaps[df_gaps["is_target_metier"]].copy()
    if not df_target.empty:
        agg_t = (
            df_target.groupby(group_cols + ["target_metier_id"], dropna=False)
            .agg(
                n_students=("auth_id", "nunique"),
                avg_similarity=("similarity_score", "mean"),
                impacted_auth_ids=("auth_id", lambda x: list(set(x))),
            )
            .reset_index()
            .rename(columns={"target_metier_id": "metier_id"})
        )
        agg_t["cohort_size"] = agg_t["metier_name"].map(cohort_map).fillna(1).astype(int)
        agg_t["pct"] = (agg_t["n_students"] / agg_t["cohort_size"] * 100).round(1)
        agg_t["priority"] = agg_t["pct"].apply(priority_label)
        agg_t["bucket"] = "TARGET_METIER"
        agg_t["popularity_rank"] = agg_t["metier_name"].map(rank_map).fillna(99).astype(int)
    else:
        agg_t = pd.DataFrame()

    df_other = df_gaps[~df_gaps["is_target_metier"]].copy()
    if not df_other.empty:
        agg_o = (
            df_other.groupby(group_cols, dropna=False)
            .agg(
                n_students=("auth_id", "nunique"),
                avg_similarity=("similarity_score", "mean"),
                impacted_auth_ids=("auth_id", lambda x: list(set(x))),
            )
            .reset_index()
        )
        agg_o["metier_id"] = None
        agg_o["cohort_size"] = n_students
        agg_o["pct"] = (agg_o["n_students"] / n_students * 100).round(1)
        agg_o["priority"] = agg_o["pct"].apply(priority_label)
        agg_o["bucket"] = "OTHER_METIER"
        agg_o["popularity_rank"] = agg_o["metier_name"].map(rank_map).fillna(99).astype(int)
    else:
        agg_o = pd.DataFrame()

    cols = ["bucket", "metier_id", "metier_name", "domaine_name", "competence_name",
            "competence_type", "keywords", "n_students", "cohort_size", "pct",
            "priority", "popularity_rank", "avg_similarity", "impacted_auth_ids"]

    frames = [f[cols] for f in (agg_t, agg_o) if not f.empty]
    if not frames:
        return pd.DataFrame(), n_students

    df_agg = pd.concat(frames, ignore_index=True)
    df_agg["bucket_order"] = df_agg["bucket"].map({"TARGET_METIER": 0, "OTHER_METIER": 1})
    df_agg = (
        df_agg.sort_values(["bucket_order", "popularity_rank", "pct"], ascending=[True, True, False])
        .drop(columns=["bucket_order"])
        .reset_index(drop=True)
    )
    return df_agg, n_students


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_recommendations_pipeline(job_id: str, triggered_by: Optional[str] = None) -> dict[str, Any]:
    """
    Pipeline complet. Met a jour recommendation_jobs au fur et a mesure.
    """
    started = time.time()
    supabase_upsert(
        "recommendation_jobs",
        [{
            "id": job_id,
            "status": "running",
            "triggered_by": triggered_by,
            "started_at": _iso_now(),
            "stats": {"stage": "loading"},
        }],
        on_conflict="id",
    )

    try:
        df_agg, n_students = load_and_aggregate_gaps()
        total = len(df_agg)
        LOGGER.info("Job %s: %d gaps aggreges / %d etudiants", job_id, total, n_students)

        supabase_upsert(
            "recommendation_jobs",
            [{
                "id": job_id,
                "stats": {"stage": "generating", "total": total, "n_students": n_students},
            }],
            on_conflict="id",
        )

        now_iso = _iso_now()
        reco_rows: list[dict[str, Any]] = []
        target_rows: list[dict[str, Any]] = []
        daily_cap_hit = False
        llm_calls_used = 0

        for idx, (_, row) in enumerate(df_agg.iterrows()):
            gap = row.to_dict()
            query = f"{gap['competence_name']} {gap.get('keywords') or ''} {gap['metier_name']}"
            rag = retrieve(query)

            if daily_cap_hit:
                # All LLM providers already exhausted - pull fields from RAG so the row is still useful.
                reco = _rag_only_recommendation(gap, rag)
            elif MAX_LLM_CALLS > 0 and llm_calls_used >= MAX_LLM_CALLS:
                reco = _rag_only_recommendation(gap, rag)
                reco["llm_recommendation"] = (
                    f"[Cap local MAX_LLM_CALLS={MAX_LLM_CALLS} atteint] " + reco.get("llm_recommendation", "")
                )
            else:
                try:
                    reco = llm_recommend(gap, rag)
                    llm_calls_used += 1
                except LLMDailyCapExhausted as exc:
                    LOGGER.warning(
                        "All providers daily-cap reached; remaining gaps will use RAG-only fallback.",
                    )
                    daily_cap_hit = True
                    # Still produce a useful row from the RAG corpus instead of "LLM indisponible".
                    reco = _rag_only_recommendation(gap, rag)
                    reco["llm_recommendation"] = (
                        f"[Providers LLM indisponibles: {exc}] " + reco.get("llm_recommendation", "")
                    )
                except Exception as exc:
                    LOGGER.warning("LLM failed for %s: %s", gap.get("competence_name"), exc)
                    reco = {
                        "cert_title": "[ERREUR]",
                        "cert_provider": "", "cert_duration": "", "cert_pricing": "",
                        "cert_url": "", "cert_description": str(exc),
                        "llm_recommendation": f"[Erreur LLM: {exc}]",
                        "gap_label": (gap["competence_name"] or "")[:60],
                        "gap_title": (gap["competence_name"] or "")[:100],
                    }

            rec_id = build_recommendation_id(gap["bucket"], gap["metier_name"], gap["competence_name"])
            keywords_json = [k.strip() for k in (gap.get("keywords") or "").split(",") if k.strip()]
            rag_sources = " | ".join(f"{r['source']}:{r['titre'][:25]}" for r in rag[:3])

            reco_rows.append({
                "id": rec_id,
                "status": "pending",
                "category": gap["bucket"],
                "level": gap["priority"],
                "metier": gap["metier_name"],
                "metier_id": gap.get("metier_id"),
                "domaine": gap["domaine_name"],
                "competence_name": gap["competence_name"],
                "competence_type": gap["competence_type"],
                "keywords": keywords_json,
                "gap_label": (reco.get("gap_label") or gap["competence_name"])[:60],
                "gap_title": (reco.get("gap_title") or gap["competence_name"])[:100],
                "concern_rate": float(gap["pct"]),
                "students_impacted": int(gap["n_students"]),
                "cohort_size": int(gap["cohort_size"]),
                "total_students": int(n_students),
                "popularity_rank": int(gap["popularity_rank"]),
                "llm_recommendation": reco.get("llm_recommendation", ""),
                "cert_title": reco.get("cert_title", ""),
                "cert_description": reco.get("cert_description", ""),
                "cert_provider": reco.get("cert_provider", ""),
                "cert_duration": reco.get("cert_duration", ""),
                "cert_pricing": reco.get("cert_pricing", ""),
                "cert_url": reco.get("cert_url", ""),
                "rag_sources": rag_sources,
                "detected_gap": gap["competence_name"],
                "recommended_certs": reco.get("cert_title", ""),
                "justification_llm": reco.get("llm_recommendation", ""),
                "created_at": now_iso,
                "updated_at": now_iso,
            })

            for auth_id in gap.get("impacted_auth_ids") or []:
                target_rows.append({"recommendation_id": rec_id, "auth_id": auth_id})

            if (idx + 1) % 25 == 0 or idx == total - 1:
                LOGGER.info("Job %s progress: %d/%d", job_id, idx + 1, total)
                try:
                    supabase_upsert(
                        "recommendation_jobs",
                        [{
                            "id": job_id,
                            "stats": {"stage": "generating", "total": total, "done": idx + 1, "n_students": n_students},
                        }],
                        on_conflict="id",
                    )
                except Exception:
                    pass

            if GEMINI_RATE_LIMIT_SLEEP > 0:
                time.sleep(GEMINI_RATE_LIMIT_SLEEP)

        # Deduplicate (same recommendation_id could appear across buckets with same key)
        seen: set[str] = set()
        deduped_reco: list[dict[str, Any]] = []
        for r in reco_rows:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            deduped_reco.append(r)

        existing_status_by_id = get_recommendation_status_map([r["id"] for r in deduped_reco])
        preserved_ids: set[str] = set()
        upsertable_reco: list[dict[str, Any]] = []
        for row in deduped_reco:
            current_status = existing_status_by_id.get(row["id"], "")
            # Preserve admin decisions across runs: do not reset approved/edited/rejected to pending.
            if current_status and current_status != "pending":
                preserved_ids.add(row["id"])
                continue
            upsertable_reco.append(row)

        if upsertable_reco:
            supabase_upsert("ai_recommendations", upsertable_reco, on_conflict="id")

        target_rows_upsertable = [
            t for t in target_rows if t.get("recommendation_id") not in preserved_ids
        ]
        if target_rows_upsertable:
            supabase_upsert("ai_recommendation_targets", target_rows_upsertable, on_conflict="recommendation_id,auth_id")

        elapsed = round(time.time() - started, 1)
        stats = {
            "stage": "done",
            "total_generated": len(upsertable_reco),
            "targets": len(target_rows_upsertable),
            "preserved_non_pending": len(preserved_ids),
            "n_students": n_students,
            "elapsed_sec": elapsed,
            "daily_cap_hit": daily_cap_hit,
        }
        supabase_upsert(
            "recommendation_jobs",
            [{
                "id": job_id,
                "status": "succeeded",
                "finished_at": _iso_now(),
                "stats": stats,
            }],
            on_conflict="id",
        )
        LOGGER.info(
            "Job %s done in %.1fs - %d reco inserted, %d preserved.",
            job_id,
            elapsed,
            len(upsertable_reco),
            len(preserved_ids),
        )
        return {"ok": True, "job_id": job_id, **stats}

    except Exception as exc:
        LOGGER.exception("Job %s failed", job_id)
        try:
            supabase_upsert(
                "recommendation_jobs",
                [{
                    "id": job_id,
                    "status": "failed",
                    "finished_at": _iso_now(),
                    "error": str(exc)[:2000],
                }],
                on_conflict="id",
            )
        except Exception:
            pass
        return {"ok": False, "job_id": job_id, "error": str(exc)}


# =============================================================================
# FastAPI app
# =============================================================================

app = FastAPI(title="Recommendation Service", version="1.0.0")


class GenerateRequest(BaseModel):
    triggered_by: Optional[str] = None
    job_id: Optional[str] = None
    wait: bool = False  # if true, run synchronously (useful for small datasets / CLI)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "llm_provider": "gemini",
        "gemini_model": GEMINI_MODEL,
        "gemini_configured": bool(GEMINI_API_KEY),
        "rag_xlsx": RAG_XLSX_PATH,
        "rag_exists": Path(RAG_XLSX_PATH).exists(),
    }


@app.post("/generate")
def generate(payload: GenerateRequest) -> dict[str, Any]:
    job_id = (payload.job_id or f"job_{uuid.uuid4().hex[:12]}").strip()

    if payload.wait:
        result = generate_recommendations_pipeline(job_id, payload.triggered_by)
        status_code = 200 if result.get("ok") else 500
        if status_code != 200:
            raise HTTPException(status_code=status_code, detail=result)
        return result

    # Async: kick off a background thread
    thread = threading.Thread(
        target=generate_recommendations_pipeline,
        args=(job_id, payload.triggered_by),
        name=f"reco-{job_id}",
        daemon=True,
    )
    thread.start()
    return {"ok": True, "job_id": job_id, "status": "running"}


@app.get("/status/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    rows = supabase_select(
        "recommendation_jobs",
        {"select": "*", "id": f"eq.{job_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="job not found")
    return rows[0]
