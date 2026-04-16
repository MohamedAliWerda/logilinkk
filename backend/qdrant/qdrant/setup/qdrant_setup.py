"""
=============================================================================
  QDRANT VECTOR DATABASE SETUP FOR COMPETENCE GAP RECOMMENDATION SYSTEM
=============================================================================

This script:
  1. Creates the Qdrant collections with proper schema
  2. Embeds all RAG documents using sentence-transformers
  3. Upserts everything into Qdrant
  4. Shows how to query for recommendations

Requirements:
    pip install qdrant-client sentence-transformers pandas openpyxl

Qdrant setup:
    docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
"""

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
    PayloadSchemaType,
)
from sentence_transformers import SentenceTransformer
import pandas as pd
import uuid
import os


# ===========================================================================
# CONFIG
# ===========================================================================
QDRANT_URL = os.environ.get("QDRANT_URL", "https://4252fbd0-800c-46ef-9748-3e52c7b9f434.eu-central-1-0.aws.cloud.qdrant.io")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6ZjIyYzNmNzEtODFhMy00ZDQ5LWFhNWMtNDU4NjEyNjg2N2NkIn0.ZcoJHD5QMW3BtI6X9we8YU968bGFGnD6e5xnqHxtcJU")
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
VECTOR_DIM = 384  # output dim of MiniLM

# Resolve paths relative to this script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
RAG_PATH = os.path.join(DATA_DIR, "RAG_MASTER_v3_FINAL.xlsx")
RESULTS_PATH = os.path.join(DATA_DIR, "cv_matching_competence_results_rows.csv")
METIER_PATH = os.path.join(DATA_DIR, "cv_matching_metier_scores_rows.csv")


# ===========================================================================
# STEP 0: CONNECT
# ===========================================================================
def connect():
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    model = SentenceTransformer(EMBED_MODEL)
    print(f"Connected to Qdrant at {QDRANT_URL}")
    print(f"Loaded embedding model: {EMBED_MODEL} (dim={VECTOR_DIM})")
    return client, model


# ===========================================================================
# STEP 1: CREATE COLLECTIONS
# ===========================================================================
def create_collections(client):

    # --- Collection 1: RAG Knowledge Base ---
    client.recreate_collection(
        collection_name="rag_knowledge",
        vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
    )

    # --- Collection 2: Student Gap Details ---
    client.recreate_collection(
        collection_name="student_gaps",
        vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
    )

    # --- Collection 3: Aggregated Gap Statistics ---
    client.recreate_collection(
        collection_name="gap_statistics",
        vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
    )

    print("Created 3 collections: rag_knowledge, student_gaps, gap_statistics")


# ===========================================================================
# STEP 2: POPULATE "rag_knowledge" (from RAG_MASTER sheets)
# ===========================================================================
def populate_rag_knowledge(client, model, rag_path):
    points = []

    # ----- Sheet 8: Ressources Formation (CERTIFICATIONS) -----
    df = pd.read_excel(rag_path, sheet_name="8-Ressources Formation")
    for _, row in df.iterrows():
        text = (
            f"{row['Titre']} - {row.get('Competences','')} - "
            f"{row.get('Recommande Pour','')} - {row.get('Plateforme','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "8-Ressources Formation",
                "doc_type": "certification",
                "doc_id": row["ID"],
                "titre": row["Titre"],
                "plateforme": row.get("Plateforme", ""),
                "url": str(row.get("URL", "")),
                "duree_heures": str(row.get("Duree", "")),
                "cout": str(row.get("Cout", "")),
                "langue": str(row.get("Langue", "")),
                "niveau": str(row.get("Niveau", "")),
                "competences": str(row.get("Competences", "")),
                "recommande_pour": str(row.get("Recommande Pour", "")),
                "text": text,
            },
        ))

    # ----- Sheet 9: RNCP -----
    df = pd.read_excel(rag_path, sheet_name="9-RNCP")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Certification','')} - {row.get('Metier','')} - "
            f"{row.get('Competences','')} - {row.get('Mots-cles','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "9-RNCP",
                "doc_type": "rncp_certification",
                "doc_id": str(row.get("ID", "")),
                "titre": str(row.get("Certification", "")),
                "metier": str(row.get("Metier", "")),
                "niveau": str(row.get("Niveau", "")),
                "competences": str(row.get("Competences", "")),
                "debouches": str(row.get("Debouches", "")),
                "mots_cles": str(row.get("Mots-cles", "")),
                "text": text,
            },
        ))

    # ----- Sheet 11: AFT -----
    df = pd.read_excel(rag_path, sheet_name="11-AFT")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Titre','')} - {row.get('Metier','')} - "
            f"{row.get('Certifications','')} - {row.get('Mots-cles','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "11-AFT",
                "doc_type": "aft_referentiel",
                "doc_id": str(row.get("ID", "")),
                "titre": str(row.get("Titre", "")),
                "metier": str(row.get("Metier", "")),
                "duree": str(row.get("Duree", "")),
                "certifications": str(row.get("Certifications", "")),
                "mots_cles": str(row.get("Mots-cles", "")),
                "text": text,
            },
        ))

    # ----- Sheet 19: Frequence Gaps TN -----
    df = pd.read_excel(rag_path, sheet_name="19-Frequence Gaps TN")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Gap','')} - frequence {row.get('Freq TN','')} - "
            f"{row.get('Criticite','')} - {row.get('Ressource','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "19-Frequence Gaps TN",
                "doc_type": "market_gap",
                "doc_id": str(row.get("ID", "")),
                "titre": str(row.get("Gap", "")),
                "freq_tn": str(row.get("Freq TN", "")),
                "criticite": str(row.get("Criticite", "")),
                "metiers": str(row.get("Metiers", "")),
                "ressource": str(row.get("Ressource", "")),
                "duree": str(row.get("Duree", "")),
                "text": text,
            },
        ))

    # ----- Sheet 20: Regles Recommandation -----
    df = pd.read_excel(rag_path, sheet_name="20-Regles Recommandation")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Condition','')} - {row.get('Priorite','')} - "
            f"{row.get('Action','')} - {row.get('Message Admin','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "20-Regles Recommandation",
                "doc_type": "recommendation_rule",
                "doc_id": str(row.get("ID", "")),
                "condition": str(row.get("Condition", "")),
                "priorite": str(row.get("Priorite", "")),
                "action": str(row.get("Action", "")),
                "message_admin": str(row.get("Message Admin", "")),
                "text": text,
            },
        ))

    # ----- Sheet 7: Comp Transversales -----
    df = pd.read_excel(rag_path, sheet_name="7-Comp Transversales")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Competence FR','')} - {row.get('Frequence','')} - "
            f"{row.get('Formation','')} - {row.get('Ressources Gratuites','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "7-Comp Transversales",
                "doc_type": "transversal_competence",
                "doc_id": str(row.get("ID", "")),
                "titre": str(row.get("Competence FR", "")),
                "frequence": str(row.get("Frequence", "")),
                "metiers": str(row.get("Metiers", "")),
                "formation": str(row.get("Formation", "")),
                "ressources_gratuites": str(row.get("Ressources Gratuites", "")),
                "text": text,
            },
        ))

    # ----- Sheet 2: Competences Source -----
    df = pd.read_excel(rag_path, sheet_name="2-Competences Source")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Competence','')} - {row.get('Metier','')} - "
            f"{row.get('Type','')} - {row.get('Mots-cles','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "2-Competences Source",
                "doc_type": "referentiel_competence",
                "competence": str(row.get("Competence", "")),
                "metier": str(row.get("Metier", "")),
                "domaine": str(row.get("Domaine", "")),
                "type_competence": str(row.get("Type", "")),
                "indicateurs": str(row.get("Indicateurs", "")),
                "formation": str(row.get("Formation", "")),
                "outils": str(row.get("Outils", "")),
                "mots_cles": str(row.get("Mots-cles", "")),
                "text": text,
            },
        ))

    # ----- Sheet 4: Activites Pedago -----
    df = pd.read_excel(rag_path, sheet_name="4-Activites Pedago")
    for _, row in df.iterrows():
        text = (
            f"{row.get('Activite','')} - {row.get('Type','')} - "
            f"{row.get('Competence','')} - {row.get('Mots-cles','')}"
        )
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "source": "4-Activites Pedago",
                "doc_type": "pedagogical_activity",
                "doc_id": str(row.get("ID", "")),
                "activite": str(row.get("Activite", "")),
                "type_activite": str(row.get("Type", "")),
                "metier": str(row.get("Metier", "")),
                "competence": str(row.get("Competence", "")),
                "mots_cles": str(row.get("Mots-cles", "")),
                "text": text,
            },
        ))

    # Upsert in batches of 100
    for i in range(0, len(points), 100):
        client.upsert(collection_name="rag_knowledge", points=points[i:i+100])

    print(f"rag_knowledge: {len(points)} points upserted")
    return len(points)


# ===========================================================================
# STEP 3: POPULATE "student_gaps" (from cv_matching_competence_results)
# ===========================================================================
def populate_student_gaps(client, model, results_path):
    df = pd.read_csv(results_path)
    points = []

    unique_comps = df["competence_name"].unique().tolist()
    comp_vectors = {c: model.encode(c).tolist() for c in unique_comps}

    for _, row in df.iterrows():
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=comp_vectors[row["competence_name"]],
            payload={
                "auth_id": row["auth_id"],
                "cv_submission_id": row["cv_submission_id"],
                "analysis_id": row["analysis_id"],
                "status": row["status"],
                "competence_name": row["competence_name"],
                "competence_type": row["competence_type"],
                "keywords": str(row.get("keywords", "")),
                "metier_name": row["metier_name"],
                "domaine_name": row["domaine_name"],
                "best_cv_skill": str(row.get("best_cv_skill", "")),
                "best_cv_level": str(row.get("best_cv_level", "")),
                "similarity_score": float(row.get("similarity_score", 0)),
                "metier_rank": int(row.get("metier_rank", 0)),
                "is_top_metier": bool(row.get("is_top_metier", False)),
            },
        ))

    for i in range(0, len(points), 100):
        client.upsert(collection_name="student_gaps", points=points[i:i+100])

    print(f"student_gaps: {len(points)} points upserted ({df['auth_id'].nunique()} students)")
    return len(points)


# ===========================================================================
# STEP 4: POPULATE "gap_statistics" (aggregated from student_gaps)
# ===========================================================================
def populate_gap_statistics(client, model, results_path):
    df = pd.read_csv(results_path)
    n_students = df["auth_id"].nunique()
    gaps = df[df["status"] == "gap"]

    gf = (
        gaps.groupby(["competence_name", "metier_name", "domaine_name", "competence_type", "keywords"])
        .agg(
            n_gap=("auth_id", "nunique"),
            avg_similarity=("similarity_score", "mean"),
            student_ids=("auth_id", lambda x: list(x.unique())),
        )
        .reset_index()
    )
    gf["pct_students"] = (gf["n_gap"] / n_students * 100).round(1)
    gf = gf.sort_values("pct_students", ascending=False).reset_index(drop=True)

    points = []
    for _, row in gf.iterrows():
        text = f"{row['competence_name']} - {row['keywords']} - {row['metier_name']}"
        vector = model.encode(text).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "competence_name": row["competence_name"],
                "metier_name": row["metier_name"],
                "domaine_name": row["domaine_name"],
                "competence_type": row["competence_type"],
                "keywords": row["keywords"],
                "n_gap": int(row["n_gap"]),
                "n_students_total": n_students,
                "pct_students": float(row["pct_students"]),
                "avg_similarity": round(float(row["avg_similarity"]), 4),
                "student_ids": row["student_ids"],
            },
        ))

    for i in range(0, len(points), 100):
        client.upsert(collection_name="gap_statistics", points=points[i:i+100])

    print(f"gap_statistics: {len(points)} points upserted")
    return len(points)


# ===========================================================================
# STEP 5: CREATE PAYLOAD INDEXES (for fast filtering)
# ===========================================================================
def create_indexes(client):
    client.create_payload_index("rag_knowledge", "doc_type", PayloadSchemaType.KEYWORD)
    client.create_payload_index("rag_knowledge", "source", PayloadSchemaType.KEYWORD)

    client.create_payload_index("student_gaps", "auth_id", PayloadSchemaType.KEYWORD)
    client.create_payload_index("student_gaps", "status", PayloadSchemaType.KEYWORD)
    client.create_payload_index("student_gaps", "metier_name", PayloadSchemaType.KEYWORD)
    client.create_payload_index("student_gaps", "competence_name", PayloadSchemaType.KEYWORD)

    client.create_payload_index("gap_statistics", "pct_students", PayloadSchemaType.FLOAT)
    client.create_payload_index("gap_statistics", "competence_type", PayloadSchemaType.KEYWORD)

    print("Payload indexes created")


# ===========================================================================
# STEP 6: QUERY EXAMPLES
# ===========================================================================
def demo_queries(client, model):
    print("\n" + "=" * 70)
    print("QUERY EXAMPLES")
    print("=" * 70)

    # --- Query 1: Top gaps across all students ---
    print("\nQuery 1: Top 5 competence gaps across all students")
    all_gaps = client.scroll(collection_name="gap_statistics", limit=200)[0]
    sorted_gaps = sorted(all_gaps, key=lambda p: p.payload["pct_students"], reverse=True)
    for p in sorted_gaps[:5]:
        pl = p.payload
        print(f"  {pl['pct_students']}% - {pl['competence_name'][:60]} ({pl['metier_name']})")

    # --- Query 2: RAG retrieval for a gap ---
    print("\nQuery 2: RAG retrieval - best certification for 'FIFO/ABC' gap")
    gap_query = "Appliquer les methodes FIFO/ABC et analyser la rotation des stocks"
    vector = model.encode(gap_query).tolist()

    rag_results = client.search(
        collection_name="rag_knowledge",
        query_vector=vector,
        query_filter=Filter(
            should=[
                FieldCondition(key="doc_type", match=MatchValue(value="certification")),
                FieldCondition(key="doc_type", match=MatchValue(value="market_gap")),
                FieldCondition(key="doc_type", match=MatchValue(value="recommendation_rule")),
            ]
        ),
        limit=5,
    )
    for r in rag_results:
        print(f"  [{r.score:.3f}] {r.payload['source']}: {r.payload.get('titre', r.payload.get('condition', ''))[:60]}")

    # --- Query 3: All gaps for a specific student ---
    print("\nQuery 3: All gaps for a specific student")
    sample_student = sorted_gaps[0].payload["student_ids"][0] if sorted_gaps else None
    if sample_student:
        student_results = client.scroll(
            collection_name="student_gaps",
            scroll_filter=Filter(
                must=[
                    FieldCondition(key="auth_id", match=MatchValue(value=sample_student)),
                    FieldCondition(key="status", match=MatchValue(value="gap")),
                ]
            ),
            limit=200,
        )[0]
        print(f"  Student {sample_student[:20]}... has {len(student_results)} gaps")
        for p in student_results[:3]:
            pl = p.payload
            print(f"    - {pl['competence_name'][:50]} (sim: {pl['similarity_score']:.3f})")

    # --- Query 4: Students lacking a specific competence ---
    print("\nQuery 4: Which students lack 'Appliquer les methodes FIFO/ABC'?")
    fifo_gaps = client.scroll(
        collection_name="student_gaps",
        scroll_filter=Filter(
            must=[
                FieldCondition(key="competence_name", match=MatchValue(
                    value="Appliquer les methodes FIFO/ABC et analyser la rotation des stocks"
                )),
                FieldCondition(key="status", match=MatchValue(value="gap")),
            ]
        ),
        limit=200,
    )[0]
    print(f"  {len(fifo_gaps)} students have this gap")

    # --- Query 5: Full recommendation pipeline ---
    print("\nQuery 5: Full recommendation pipeline for top gap")
    if sorted_gaps:
        top_gap = sorted_gaps[0].payload
        query_text = f"{top_gap['competence_name']} {top_gap['keywords']} {top_gap['metier_name']}"
        query_vec = model.encode(query_text).tolist()

        certifs = client.search(
            collection_name="rag_knowledge",
            query_vector=query_vec,
            query_filter=Filter(
                should=[
                    FieldCondition(key="doc_type", match=MatchValue(value="certification")),
                    FieldCondition(key="doc_type", match=MatchValue(value="rncp_certification")),
                    FieldCondition(key="doc_type", match=MatchValue(value="aft_referentiel")),
                ]
            ),
            limit=3,
        )
        best_certif = certifs[0].payload["titre"] if certifs else "N/A"

        rules = client.search(
            collection_name="rag_knowledge",
            query_vector=query_vec,
            query_filter=Filter(
                must=[FieldCondition(key="doc_type", match=MatchValue(value="recommendation_rule"))]
            ),
            limit=2,
        )

        print(f"\n  {top_gap['pct_students']}% des etudiants ({top_gap['n_gap']}/{top_gap['n_students_total']}) "
              f"ont un gap en '{top_gap['competence_name']}'")
        print(f"  Certification recommandee : '{best_certif}'")
        print(f"  Metier : {top_gap['metier_name']}")
        if rules:
            print(f"  Regle : {rules[0].payload.get('action', '')} - {rules[0].payload.get('message_admin', '')[:80]}")

        print("\n  LLM prompt context (from Qdrant RAG):")
        for c in certifs:
            print(f"    - {c.payload['source']}: {c.payload.get('titre', '')}")


# ===========================================================================
# MAIN
# ===========================================================================
def main():
    client, model = connect()

    print("\n" + "=" * 70)
    print("STEP 1: Creating collections")
    print("=" * 70)
    create_collections(client)

    print("\n" + "=" * 70)
    print("STEP 2: Populating rag_knowledge")
    print("=" * 70)
    populate_rag_knowledge(client, model, RAG_PATH)

    print("\n" + "=" * 70)
    print("STEP 3: Populating student_gaps")
    print("=" * 70)
    populate_student_gaps(client, model, RESULTS_PATH)

    print("\n" + "=" * 70)
    print("STEP 4: Populating gap_statistics")
    print("=" * 70)
    populate_gap_statistics(client, model, RESULTS_PATH)

    print("\n" + "=" * 70)
    print("STEP 5: Creating indexes")
    print("=" * 70)
    create_indexes(client)

    print("\n" + "=" * 70)
    print("STEP 6: Demo queries")
    print("=" * 70)
    demo_queries(client, model)

    for name in ["rag_knowledge", "student_gaps", "gap_statistics"]:
        info = client.get_collection(name)
        print(f"\n  {name}: {info.points_count} points")

    print("\nQdrant is ready for the recommendation system!")


if __name__ == "__main__":
    main()
