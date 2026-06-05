"""
run_score_v2
============
Non-interactive runner for Score Employabilite V2.
Receives certifications and score_base as JSON, runs llm_pipeline,
then computes the final score with score_employabilite_v2.
"""

from __future__ import annotations

import argparse
import json
import logging
import tempfile
import sys
from pathlib import Path
from typing import Any, Dict, List

from llm_pipeline import LLMPipeline, LocalLLMClient, PipelineError
from score_employabilite_v2 import EmployabilityScoreCalculator, EmployabilityError


PROJECT_ROOT = Path(__file__).resolve().parent
LOGGER = logging.getLogger("score_v2_runner")


def _normalize_certifications(raw_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue

        title = str(item.get("title", "")).strip()
        source = str(item.get("source", "")).strip()
        description = str(item.get("description", "")).strip()

        try:
            duration_hours = int(float(item.get("duration_hours", 0) or 0))
        except (TypeError, ValueError):
            duration_hours = 0

        if not title:
            continue

        normalized.append(
            {
                "title": title,
                "source": source or "N/A",
                "duration_hours": max(duration_hours, 0),
                "description": description,
            }
        )

    return normalized


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    LOGGER.info("step 1/7: parsing input payload")
    score_base = float(payload.get("score_base", 55))
    raw_certs = payload.get("certifications", [])
    if not isinstance(raw_certs, list):
        raise ValueError("'certifications' must be a JSON array")

    LOGGER.info("step 2/7: normalizing certifications")
    certifications = _normalize_certifications(raw_certs)
    if not certifications:
        raise ValueError("No valid certifications provided")
    LOGGER.info("normalized certifications count=%d", len(certifications))

    with tempfile.TemporaryDirectory(prefix="score-v2-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        certs_path = tmp_path / "certifications.json"
        output_path = tmp_path / "output_llm.json"

        LOGGER.info("step 3/7: writing temporary certifications file")
        certs_path.write_text(
            json.dumps(certifications, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        LOGGER.info("step 4/7: initializing local LLM client and selecting model")
        pipeline = LLMPipeline(
            certs_path=certs_path,
            prompt_path=PROJECT_ROOT / "prompt.txt",
            output_path=output_path,
            llm_client=LocalLLMClient(),
        )

        LOGGER.info("step 5/7: running llm_pipeline over certifications")
        pipeline.run()

        LOGGER.info("step 6/7: computing employability score from LLM output")
        calculator = EmployabilityScoreCalculator(score_base=score_base, json_path=output_path)
        result = calculator.calculate()

        LOGGER.info("step 7/7: preparing final response score_final=%.2f", result.score_final)

        return {
            "score_base": result.score_base,
            "total_delta": result.total_delta,
            "score_final": result.score_final,
            "certification_count": len(certifications),
        }


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser(description="Run Score Employabilite V2 non-interactively")
    parser.add_argument("--input-json", required=True, help="JSON string payload")
    args = parser.parse_args()

    try:
        LOGGER.info("received run request")
        payload = json.loads(args.input_json)
        if not isinstance(payload, dict):
            raise ValueError("Input payload must be a JSON object")

        result = run(payload)
        LOGGER.info("run finished successfully")
        print(json.dumps(result, ensure_ascii=False))
    except (json.JSONDecodeError, ValueError, PipelineError, EmployabilityError) as exc:
        LOGGER.error("run failed: %s", exc)
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
