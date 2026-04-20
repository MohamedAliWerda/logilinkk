from __future__ import annotations

import logging
import os
import re
import unicodedata
import uuid
import importlib
from collections import defaultdict
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
from supabase import Client, create_client

try:
    from groq import Groq
except Exception:  # pragma: no cover
    Groq = None  # type: ignore[assignment]


LOGGER = logging.getLogger("recommendations_service")
logging.basicConfig(level=logging.INFO)
load_dotenv()

DEFAULT_EMBED_MODEL = os.getenv("EMBED_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
DEFAULT_RAG_COLLECTION = os.getenv("RAG_COLLECTION", "rag_formations")
DEFAULT_RAG_FALLBACK_COLLECTIONS = [
    item.strip()
    for item in os.getenv("RAG_FALLBACK_COLLECTIONS", "rag_knowledge").split(",")
    if item.strip()
]
DEFAULT_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
DEFAULT_GAP_MIN_PCT = float(os.getenv("GAP_MIN_PCT", "10"))
DEFAULT_MAX_ROWS = int(os.getenv("RECOMMENDATIONS_MAX_ROWS", "20000"))
DEFAULT_MATCHING_RESULTS_TABLE = os.getenv("MATCHING_RESULTS_TABLE", "cv_matching_competence_results")
DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
DEFAULT_RAG_XLSX_PATH = os.getenv("RAG_XLSX_PATH", "").strip()
DEFAULT_RAG_INDEX_BATCH = int(os.getenv("RAG_INDEX_BATCH", "64"))


class RagHit(BaseModel):
    score: float
    source: str
    titre: str
    text: str


class GapAggregate(BaseModel):
    cv_submission_id: str | None = None
    target_job_id: str | None = None
    competence_name: str
    metier_name: str
    domaine_name: str
    competence_type: str
    keywords: str
    n_gap: int
    avg_sim: float
    pct: float
    total_students_scope: int = 0


class RecommendationItem(BaseModel):
    rank: int
    cv_submission_id: str | None = None
    target_job_id: str | None = None
    competence: str
    metier: str
    domaine: str
    competence_type: str
    keywords: str
    pct_gap: float
    n_gap: int
    priority: str
    recommended_certification: str
    recommendation_text: str
    rag_results: list[RagHit]


class GenerateRecommendationsRequest(BaseModel):
    gap_min_pct: float = Field(default=DEFAULT_GAP_MIN_PCT, ge=0, le=100)
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=20)
    max_items: int = Field(default=50, ge=1, le=300)
    rag_collection: str | None = None
    use_llm: bool = False


class GenerateRecommendationsResponse(BaseModel):
    generated_at: str
    qdrant_collection: str
    total_students: int
    total_unique_gaps: int
    significant_gaps: int
    recommendations: list[RecommendationItem]


app = FastAPI(title="AI Recommendations Service", version="1.0.0")


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _to_safe_str(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    if not np.isfinite(parsed):
        return fallback
    return parsed


def _to_int(value: Any, fallback: int | None = None) -> int | None:
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        return fallback
    return parsed


def _priority_label(pct: float) -> str:
    if pct >= 80:
        return "critique"
    if pct >= 60:
        return "haute"
    if pct >= 30:
        return "moyenne"
    return "faible"


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    supabase_url = _to_safe_str(os.getenv("SUPABASE_URL"))
    supabase_key = _to_safe_str(os.getenv("SUPABASE_SERVICE_ROLE_KEY")) or _to_safe_str(
        os.getenv("SUPABASE_KEY")
    )

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) are required")

    return create_client(supabase_url, supabase_key)


@lru_cache(maxsize=1)
def get_qdrant() -> QdrantClient:
    qdrant_url = _to_safe_str(os.getenv("QDRANT_URL"))
    qdrant_api_key = _to_safe_str(os.getenv("QDRANT_API_KEY"))

    if not qdrant_url:
        raise RuntimeError("QDRANT_URL is required")

    return QdrantClient(url=qdrant_url, api_key=qdrant_api_key or None)


@lru_cache(maxsize=1)
def get_embed_model() -> Any | None:
    try:
        sentence_transformers = importlib.import_module("sentence_transformers")
        model_cls = getattr(sentence_transformers, "SentenceTransformer")
    except Exception:
        LOGGER.warning("sentence-transformers is unavailable; lexical fallback embeddings enabled")
        return None

    LOGGER.info("Loading embedding model: %s", DEFAULT_EMBED_MODEL)
    try:
        return model_cls(DEFAULT_EMBED_MODEL)
    except Exception as exc:
        LOGGER.warning("Embedding model failed to load, lexical fallback enabled: %s", exc)
        return None


@lru_cache(maxsize=1)
def get_groq_client() -> Any | None:
    api_key = _to_safe_str(os.getenv("GROQ_API_KEY"))
    if not api_key or Groq is None:
        return None

    try:
        return Groq(api_key=api_key)
    except Exception as exc:
        LOGGER.warning("Groq client init failed, falling back to template recommendations: %s", exc)
        return None


def _fallback_encode(phrases: list[str], dim: int = 384) -> np.ndarray:
    vectors = np.zeros((len(phrases), dim), dtype=np.float32)
    token_re = re.compile(r"[a-z0-9_]{2,}")

    for i, phrase in enumerate(phrases):
        for token in token_re.findall(_normalize_text(phrase)):
            vectors[i, hash(token) % dim] += 1.0

    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    np.divide(vectors, np.maximum(norms, 1e-9), out=vectors)
    return vectors


def _encode_texts(phrases: list[str]) -> np.ndarray:
    if not phrases:
        return np.zeros((0, 384), dtype=np.float32)

    model = get_embed_model()
    if model is None:
        return _fallback_encode(phrases)

    return np.asarray(model.encode(phrases, normalize_embeddings=True, show_progress_bar=False))


def _resolve_rag_collection(client: QdrantClient, requested: str | None) -> str:
    candidates: list[str] = []
    if requested and requested.strip():
        candidates.append(requested.strip())

    candidates.append(DEFAULT_RAG_COLLECTION)
    for fallback in DEFAULT_RAG_FALLBACK_COLLECTIONS:
        if fallback not in candidates:
            candidates.append(fallback)

    for collection_name in candidates:
        try:
            if client.collection_exists(collection_name):
                return collection_name
        except Exception as exc:
            LOGGER.warning("Failed while checking collection %s: %s", collection_name, exc)

    # Return first candidate even if absent; caller may initialize collection and index it.
    return candidates[0]


def _rag_title_from_row(row: dict[str, Any], candidates: list[str]) -> str:
    for key in candidates:
        value = str(row.get(key, "") or "").strip()
        if value:
            return value
    return "N/A"


def _build_rag_docs_from_excel(xlsx_path: str) -> list[dict[str, str]]:
    sheet_configs: dict[str, dict[str, Any]] = {
        "8-Ressources Formation": {
            "fmt": lambda r: (
                f"[CERTIF] {r.get('Titre','')} | Plateforme: {r.get('Plateforme','')} | "
                f"Duree: {r.get('Duree','')}h | Competences: {r.get('Competences','')} | "
                f"Pour: {r.get('Recommande Pour','')}"
            ),
            "titles": ["Titre"],
        },
        "9-RNCP": {
            "fmt": lambda r: (
                f"[RNCP] {r.get('Certification','')} | Metier: {r.get('Metier','')} | "
                f"Competences: {r.get('Competences','')} | Mots-cles: {r.get('Mots-cles','')}"
            ),
            "titles": ["Certification"],
        },
        "11-AFT": {
            "fmt": lambda r: (
                f"[AFT] {r.get('Titre','')} | Metier: {r.get('Metier','')} | "
                f"Certif: {r.get('Certifications','')} | Mots-cles: {r.get('Mots-cles','')}"
            ),
            "titles": ["Titre"],
        },
        "19-Frequence Gaps TN": {
            "fmt": lambda r: (
                f"[GAP_TN] {r.get('Gap','')} | Criticite: {r.get('Criticite','')} | "
                f"Ressource: {r.get('Ressource','')} | Duree: {r.get('Duree','')}"
            ),
            "titles": ["Gap"],
        },
        "20-Regles Recommandation": {
            "fmt": lambda r: (
                f"[REGLE] {r.get('Condition','')} | Priorite: {r.get('Priorite','')} | "
                f"Action: {r.get('Action','')} | {r.get('Message Admin','')}"
            ),
            "titles": ["Condition"],
        },
        "7-Comp Transversales": {
            "fmt": lambda r: (
                f"[TRANSV] {r.get('Competence FR','')} | Freq: {r.get('Frequence','')} | "
                f"Formation: {r.get('Formation','')} | Ressources: {r.get('Ressources Gratuites','')}"
            ),
            "titles": ["Competence FR"],
        },
        "23-Comp Emergentes": {
            "fmt": lambda r: (
                f"[EMERGENT] {r.get('Competence','')} | Tendance: {r.get('Tendance','')} | "
                f"Formation: {r.get('Formation','')} | Outils: {r.get('Outils','')}"
            ),
            "titles": ["Competence"],
        },
    }

    docs: list[dict[str, str]] = []
    for sheet_name, cfg in sheet_configs.items():
        try:
            frame = pd.read_excel(xlsx_path, sheet_name=sheet_name)
        except Exception as exc:
            LOGGER.warning("Unable to read sheet %s: %s", sheet_name, exc)
            continue

        for _, row in frame.iterrows():
            raw = row.to_dict()
            text = str(cfg["fmt"](raw)).strip()
            if len(text) <= 10:
                continue
            docs.append(
                {
                    "source": sheet_name,
                    "titre": _rag_title_from_row(raw, cfg["titles"]),
                    "text": text,
                }
            )

    return docs


def _resolve_vector_dim() -> int:
    model = get_embed_model()
    if model is not None and hasattr(model, "get_sentence_embedding_dimension"):
        try:
            return int(model.get_sentence_embedding_dimension())
        except Exception:
            return 384
    return 384


def _index_rag_from_excel(client: QdrantClient, collection_name: str, xlsx_path: str) -> int:
    if not os.path.exists(xlsx_path):
        raise RuntimeError(f"RAG_XLSX_PATH does not exist: {xlsx_path}")

    docs = _build_rag_docs_from_excel(xlsx_path)
    if not docs:
        raise RuntimeError("No RAG documents extracted from provided Excel file")

    texts = [doc["text"] for doc in docs]
    points_count = 0

    for start in range(0, len(texts), DEFAULT_RAG_INDEX_BATCH):
        batch_docs = docs[start: start + DEFAULT_RAG_INDEX_BATCH]
        batch_texts = texts[start: start + DEFAULT_RAG_INDEX_BATCH]
        vectors = _encode_texts(batch_texts)

        points: list[PointStruct] = []
        for idx, doc in enumerate(batch_docs):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vectors[idx].tolist(),
                    payload={
                        "source": doc["source"],
                        "titre": doc["titre"],
                        "text": doc["text"],
                    },
                )
            )

        client.upsert(collection_name=collection_name, points=points)
        points_count += len(points)

    return points_count


def _ensure_rag_collection_ready(client: QdrantClient, collection_name: str) -> None:
    try:
        exists = client.collection_exists(collection_name)
    except Exception as exc:
        raise RuntimeError(f"Unable to verify Qdrant collection {collection_name}: {exc}") from exc

    if not exists:
        dim = _resolve_vector_dim()
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )

    info = client.get_collection(collection_name)
    current_points = int(getattr(info, "points_count", 0) or 0)
    if current_points > 0:
        return

    xlsx_path = DEFAULT_RAG_XLSX_PATH
    if not xlsx_path:
        raise RuntimeError(
            "RAG collection is empty and RAG_XLSX_PATH is not configured. Provide the Excel path to index documents."
        )

    indexed = _index_rag_from_excel(client, collection_name, xlsx_path)
    LOGGER.info("Indexed %s RAG documents into collection %s", indexed, collection_name)


def _extract_payload_field(payload: dict[str, Any], keys: list[str], fallback: str = "") -> str:
    for key in keys:
        if key in payload and str(payload[key] or "").strip():
            return str(payload[key]).strip()
    return fallback


def _query_rag(client: QdrantClient, collection_name: str, query: str, top_k: int) -> list[RagHit]:
    vectors = _encode_texts([query])
    if vectors.shape[0] == 0:
        return []

    q_vec = vectors[0].tolist()

    results = client.query_points(
        collection_name=collection_name,
        query=q_vec,
        limit=top_k,
        with_payload=True,
    ).points

    hits: list[RagHit] = []
    for item in results:
        payload = dict(item.payload or {})
        source = _extract_payload_field(payload, ["source", "sheet", "category"], "unknown")
        titre = _extract_payload_field(payload, ["titre", "title", "certification", "name"], "N/A")
        text = _extract_payload_field(payload, ["text", "content", "description"], "")
        hits.append(
            RagHit(
                score=round(_to_float(getattr(item, "score", 0.0)), 4),
                source=source,
                titre=titre,
                text=text,
            )
        )
    return hits


def _extract_certification_name(hits: list[RagHit], gap: GapAggregate) -> str:
    for hit in hits:
        title = hit.titre.strip()
        if title and title.lower() not in {"n/a", "na", "none", "unknown"}:
            return title

    for hit in hits:
        text = hit.text
        # Try to capture phrases like "[CERTIF] NAME |"
        match = re.search(r"\[certif\]\s*([^|\n]{3,120})", text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return f"Certification ciblee - {gap.competence_name}"


def _build_template_recommendation(
    gap: GapAggregate,
    n_students: int,
    certification: str,
) -> str:
    return (
        f"Constat: {gap.pct:.1f}% des etudiants ({gap.n_gap}/{n_students}) ont un gap sur {gap.competence_name}. "
        f"Certification recommandee: {certification}. "
        f"Justification: cette certification couvre le besoin pour le metier {gap.metier_name} et peut reduire rapidement le deficit de competence. "
        f"Priorite: {_priority_label(gap.pct)}; action: lancer un module pilote et suivre les gains par cohorte."
    )


def _build_llm_recommendation(
    gap: GapAggregate,
    n_students: int,
    certification: str,
    hits: list[RagHit],
) -> str:
    groq_client = get_groq_client()
    if groq_client is None:
        return _build_template_recommendation(gap, n_students, certification)

    context_lines = [
        f"- [{hit.source}] {hit.titre} | score={hit.score:.3f} | {hit.text[:180]}"
        for hit in hits[:4]
    ]

    system_prompt = (
        "Tu es un conseiller pedagogique expert ISGIS. "
        "Reponds en francais simple, en 4 lignes maximum, avec recommandations actionnables."
    )

    user_prompt = (
        "GAP DETECTE:\n"
        f"- Competence: {gap.competence_name}\n"
        f"- Metier cible: {gap.metier_name}\n"
        f"- Domaine: {gap.domaine_name}\n"
        f"- Type: {gap.competence_type}\n"
        f"- Mots cles: {gap.keywords}\n"
        f"- Impact: {gap.pct:.1f}% ({gap.n_gap}/{n_students})\n"
        f"- Similarite moyenne: {gap.avg_sim:.2f}\n"
        f"- Certification candidate: {certification}\n\n"
        "Contexte RAG:\n"
        + "\n".join(context_lines)
        + "\n\nFormat attendu: Constat | Certification | Justification | Priorite+Action"
    )

    try:
        completion = groq_client.chat.completions.create(
            model=DEFAULT_GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=280,
        )
        text = str(completion.choices[0].message.content or "").strip()
        return text or _build_template_recommendation(gap, n_students, certification)
    except Exception as exc:
        LOGGER.warning("Groq generation failed, template fallback used: %s", exc)
        return _build_template_recommendation(gap, n_students, certification)


def _fetch_rows_paginated(
    supabase: Client,
    table_name: str,
    columns: str,
    page_size: int = 1000,
    max_rows: int = DEFAULT_MAX_ROWS,
    status_filter: str | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0

    while offset < max_rows:
        query = supabase.table(table_name).select(columns).range(offset, offset + page_size - 1)
        if status_filter:
            query = query.eq("status", status_filter)

        response = query.execute()
        batch = list(response.data or [])
        rows.extend(batch)

        if len(batch) < page_size:
            break

        offset += page_size

    return rows[:max_rows]


def _load_student_target_context(
    supabase: Client,
    max_rows: int = DEFAULT_MAX_ROWS,
) -> tuple[
    dict[str, dict[str, str | None]],
    dict[str, dict[str, str | None]],
    dict[str, int],
]:
    submission_rows = _fetch_rows_paginated(
        supabase=supabase,
        table_name="cv_submissions",
        columns="auth_id,id,metier_id",
        max_rows=max_rows,
    )

    metier_rows = _fetch_rows_paginated(
        supabase=supabase,
        table_name="metier",
        columns="_id,nom_metier",
        max_rows=max_rows,
    )
    metier_name_by_id = {
        _to_safe_str(row.get("_id")): _to_safe_str(row.get("nom_metier"), _to_safe_str(row.get("_id")))
        for row in metier_rows
        if _to_safe_str(row.get("_id"))
    }

    target_by_auth: dict[str, dict[str, str | None]] = {}
    target_by_submission_id: dict[str, dict[str, str | None]] = {}
    students_per_metier: dict[str, set[str]] = defaultdict(set)

    for row in submission_rows:
        auth_id = _to_safe_str(row.get("auth_id"))
        cv_submission_id = _to_safe_str(row.get("id"))
        metier_id = _to_safe_str(row.get("metier_id"))

        if not metier_id:
            continue

        metier_name = _to_safe_str(metier_name_by_id.get(metier_id), metier_id)
        target = {
            "cv_submission_id": cv_submission_id or None,
            "metier_id": metier_id,
            "metier_name": metier_name,
        }

        if cv_submission_id:
            target_by_submission_id[cv_submission_id] = target

        if auth_id:
            # Keep the first known mapping for auth fallback; primary linkage is submission_id.
            if auth_id not in target_by_auth:
                target_by_auth[auth_id] = target
            students_per_metier[_normalize_text(metier_name)].add(auth_id)

    metier_student_counts = {key: len(value) for key, value in students_per_metier.items()}
    return target_by_auth, target_by_submission_id, metier_student_counts


def _filter_gap_rows_on_target_metier(
    gap_rows: list[dict[str, Any]],
    target_by_auth: dict[str, dict[str, str | None]],
    target_by_submission_id: dict[str, dict[str, str | None]],
) -> list[dict[str, Any]]:
    filtered_rows: list[dict[str, Any]] = []

    for row in gap_rows:
        cv_submission_id = _to_safe_str(row.get("cv_submission_id"))
        auth_id = _to_safe_str(row.get("auth_id"))
        target = target_by_submission_id.get(cv_submission_id) if cv_submission_id else None
        if target is None:
            target = target_by_auth.get(auth_id)
        if target is None:
            continue

        target_metier_name = _to_safe_str(target.get("metier_name"))
        row_metier_name = _to_safe_str(row.get("metier_name"))
        if not target_metier_name or not row_metier_name:
            continue

        if _normalize_text(row_metier_name) != _normalize_text(target_metier_name):
            continue

        enriched = dict(row)
        if not _to_safe_str(enriched.get("cv_submission_id")) and _to_safe_str(target.get("cv_submission_id")):
            enriched["cv_submission_id"] = target.get("cv_submission_id")
        enriched["target_job_id"] = target.get("metier_id")
        enriched["metier_name"] = target_metier_name
        filtered_rows.append(enriched)

    return filtered_rows


def _aggregate_gaps(
    gap_rows: list[dict[str, Any]],
    total_students: int,
    metier_student_counts: dict[str, int],
) -> list[GapAggregate]:
    groups: dict[tuple[str, str, str, str, str], dict[str, Any]] = defaultdict(
        lambda: {
            "students": set(),
            "sum_sim": 0.0,
            "n_rows": 0,
            "cv_ids": set(),
            "target_job_ids": set(),
        }
    )

    for row in gap_rows:
        competence = _to_safe_str(row.get("competence_name"), "Competence non definie")
        metier = _to_safe_str(row.get("metier_name"), "Metier non defini")
        domaine = _to_safe_str(row.get("domaine_name"), "Domaine non defini")
        comp_type = _to_safe_str(row.get("competence_type"), "")
        keywords = _to_safe_str(row.get("keywords"), "")

        key = (competence, metier, domaine, comp_type, keywords)
        bucket = groups[key]
        bucket["students"].add(_to_safe_str(row.get("auth_id"), "anonymous"))
        bucket["sum_sim"] += _to_float(row.get("similarity_score"), 0.0)
        bucket["n_rows"] += 1
        cv_id = _to_safe_str(row.get("cv_submission_id"))
        if cv_id:
            bucket["cv_ids"].add(cv_id)
        target_job_id = _to_safe_str(row.get("target_job_id"))
        if target_job_id:
            bucket["target_job_ids"].add(target_job_id)

    global_denom = max(total_students, 1)
    aggregates: list[GapAggregate] = []
    for (competence, metier, domaine, comp_type, keywords), bucket in groups.items():
        n_gap = len(bucket["students"])
        avg_sim = bucket["sum_sim"] / max(bucket["n_rows"], 1)
        metier_key = _normalize_text(metier)
        denom = max(metier_student_counts.get(metier_key, global_denom), 1)
        pct = (n_gap / denom) * 100.0
        cv_submission_id = sorted(bucket["cv_ids"])[0] if bucket["cv_ids"] else None
        target_job_id = sorted(bucket["target_job_ids"])[0] if bucket["target_job_ids"] else None
        aggregates.append(
            GapAggregate(
                cv_submission_id=cv_submission_id,
                target_job_id=target_job_id,
                competence_name=competence,
                metier_name=metier,
                domaine_name=domaine,
                competence_type=comp_type,
                keywords=keywords,
                n_gap=n_gap,
                avg_sim=round(avg_sim, 4),
                pct=round(pct, 1),
                total_students_scope=denom,
            )
        )

    aggregates.sort(key=lambda item: (item.pct, item.n_gap, -item.avg_sim), reverse=True)
    return aggregates


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        qdrant = get_qdrant()
        collection = _resolve_rag_collection(qdrant, None)
    except Exception:
        collection = "unresolved"

    return {
        "ok": True,
        "service": "recommendations",
        "embed_model": DEFAULT_EMBED_MODEL,
        "rag_collection": collection,
    }


@app.post("/recommendations/generate", response_model=GenerateRecommendationsResponse)
def generate_recommendations(payload: GenerateRecommendationsRequest) -> GenerateRecommendationsResponse:
    try:
        supabase = get_supabase()
        qdrant = get_qdrant()
        collection_name = _resolve_rag_collection(qdrant, payload.rag_collection)
        _ensure_rag_collection_ready(qdrant, collection_name)

        target_by_auth, target_by_submission_id, metier_student_counts = _load_student_target_context(supabase)
        total_students = len(target_by_auth)

        gap_rows = _fetch_rows_paginated(
            supabase=supabase,
            table_name=DEFAULT_MATCHING_RESULTS_TABLE,
            columns=(
                "auth_id,cv_submission_id,competence_name,metier_name,domaine_name,"
                "competence_type,keywords,similarity_score,status"
            ),
            status_filter="gap",
        )
        gap_rows = _filter_gap_rows_on_target_metier(gap_rows, target_by_auth, target_by_submission_id)

        aggregates = _aggregate_gaps(gap_rows, total_students, metier_student_counts)
        significant = [row for row in aggregates if row.pct >= payload.gap_min_pct]
        selected = significant[: payload.max_items]

        rows: list[RecommendationItem] = []
        for idx, gap in enumerate(selected):
            query = f"{gap.competence_name} {gap.keywords} {gap.metier_name}".strip()
            rag_hits = _query_rag(
                client=qdrant,
                collection_name=collection_name,
                query=query,
                top_k=payload.top_k,
            )
            certification = _extract_certification_name(rag_hits, gap)
            students_scope = max(gap.total_students_scope, 1)
            recommendation_text = (
                _build_llm_recommendation(gap, students_scope, certification, rag_hits)
                if payload.use_llm
                else _build_template_recommendation(gap, students_scope, certification)
            )

            rows.append(
                RecommendationItem(
                    rank=idx + 1,
                    cv_submission_id=gap.cv_submission_id,
                    target_job_id=gap.target_job_id,
                    competence=gap.competence_name,
                    metier=gap.metier_name,
                    domaine=gap.domaine_name,
                    competence_type=gap.competence_type,
                    keywords=gap.keywords,
                    pct_gap=gap.pct,
                    n_gap=gap.n_gap,
                    priority=_priority_label(gap.pct),
                    recommended_certification=certification,
                    recommendation_text=recommendation_text,
                    rag_results=rag_hits,
                )
            )

        return GenerateRecommendationsResponse(
            generated_at=datetime.now(timezone.utc).isoformat(),
            qdrant_collection=collection_name,
            total_students=total_students,
            total_unique_gaps=len(aggregates),
            significant_gaps=len(significant),
            recommendations=rows,
        )
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Recommendations generation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Recommendations generation failed: {exc}",
        ) from exc
