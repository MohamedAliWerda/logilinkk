# Recommendations Service

Standalone Python service that builds certification recommendations from:
- `cv_matching_competence_results` rows in Supabase
- Existing Qdrant RAG collections seeded from `RAG_MASTER_v3_FINAL_UPDATED.xlsx`

## Endpoints

- `GET /health`
- `POST /recommendations/generate`

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `EMBED_MODEL` (default: `paraphrase-multilingual-MiniLM-L12-v2`)
- `RAG_COLLECTION` (default: `rag_formations`)
- `RAG_FALLBACK_COLLECTIONS` (default: `rag_knowledge`)
- `RECOMMENDATIONS_MAX_ROWS` (default: `20000`)
- `GROQ_API_KEY` (optional)
- `GROQ_MODEL` (default: `llama-3.1-8b-instant`)

## Run

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

The service is intentionally independent from NestJS. NestJS should call it via HTTP.
