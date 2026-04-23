# Recommendation Service

FastAPI micro-service ISGIS — génération de recommandations de formations à
partir des gaps de compétences des étudiants.

## Flux

1. Le backend NestJS appelle `POST /generate` quand l'admin clique sur
   **"Générer les recommandations"** dans l'UI d'administration.
2. Le service :
   - Lit `cv_submissions` + `cv_matching_competence_results` depuis Supabase.
   - Agrège les gaps en deux buckets : `TARGET_METIER` (métier visé par
     l'étudiant) et `OTHER_METIER` (métiers connexes).
   - Charge `RAG_MASTER_v3_FINAL.xlsx` et fait du retrieval lexical (top-K).
   - Appelle **Gemini** pour produire la reco structurée
     (`cert_title`, `cert_provider`, `llm_recommendation`, …).
   - Si Gemini est indisponible ou si le quota journalier est atteint, un
     fallback **RAG-only** remplit les champs depuis le meilleur hit du
     référentiel afin que la ligne reste exploitable.
   - Écrit les lignes dans `ai_recommendations` (`status='pending'`) et
     `ai_recommendation_targets`.
   - Met à jour `recommendation_jobs` pour le suivi.
3. L'admin valide/modifie/rejette chaque recommandation depuis la section
   **"Validation de recommendation"**.

## Démarrage

```bash
cd recommendation_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

Variables d'environnement (toutes optionnelles, défaut en dur dans `main.py`) :

| Nom | Description |
|---|---|
| `SUPABASE_URL` | URL projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypass RLS) |
| `GEMINI_API_KEY` | Clé Google AI Studio |
| `GEMINI_MODEL` | défaut `gemini-2.5-flash-lite` |
| `RAG_XLSX_PATH` | Chemin du fichier `RAG_MASTER_v3_FINAL.xlsx` |
| `TOP_K_RAG` | Top-K retrieval (défaut 5) |
| `GEMINI_RATE_LIMIT_SLEEP` | Pause entre appels LLM (défaut 0.15s) |
| `MAX_LLM_CALLS` | Cap local sur le nb d'appels Gemini par job (0 = illimité) |

## Endpoints

- `GET /health` → indique l'état de Gemini et du fichier RAG
- `POST /generate` → `{ triggered_by?, job_id?, wait? }`
- `GET /status/{job_id}` → état stocké dans `recommendation_jobs`

## Embeddings

Le service n'utilise aucun modèle HuggingFace. Le retrieval RAG repose sur
un hachage lexical léger (pas de téléchargement de modèle, pas de GPU).
Le raisonnement est délégué à Gemini.
