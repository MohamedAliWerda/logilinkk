# Matching Service (FastAPI + BERT)

This service computes competence matching and gap analysis using:
- sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) when available
- cosine similarity (dot product on normalized embeddings)

If `sentence-transformers`/`torch` cannot be installed on the local Python version,
the service falls back to a lexical hash embedding so the API remains operational.

## 1) Setup

```bash
cd matching_service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Note: On Python 3.14+, BERT dependencies may be skipped automatically by markers
in `requirements.txt`, and lexical fallback mode will be used.

## 2) Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

## 3) Endpoints

- `GET /health`
- `POST /analyze`

The Nest backend calls this service via `MATCHING_PYTHON_SERVICE_URL` (default `http://127.0.0.1:8001`).

## 4) Environment Variables (optional)

- `BERT_MODEL_NAME` (default: `paraphrase-multilingual-MiniLM-L12-v2`)
- `MATCH_THRESHOLD` (default: `0.72`)
- `MAX_GLOBAL_GAPS` (default: `5000`)
- `MAX_TOP_METIER_GAPS` (default: `40`)
