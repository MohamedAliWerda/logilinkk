"""
score_employabilite_v2
======================
Production-grade employability score calculator.
Reads LLM-generated weights from JSON and computes strength, delta, and final score.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Union

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT: Path = Path(__file__).resolve().parent
DEFAULT_OUTPUT_JSON_PATH: Path = PROJECT_ROOT / "output_llm.json"

ALLOWED_WEIGHTS: List[float] = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
EXPECTED_METIER_COUNT: int = 24

# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------

logger = logging.getLogger("score_employabilite_v2")

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class EmployabilityError(Exception):
    """Base exception for employability score calculation."""


class ValidationError(EmployabilityError):
    """Raised when input data fails validation."""


class FileReadError(EmployabilityError):
    """Raised when the JSON file cannot be read or parsed."""

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EmployabilityInput:
    """Validated input data for the employability score calculation."""

    weights: Dict[str, float]
    delta_max_points: float


@dataclass(frozen=True)
class CertificationResult:
    """Structured result for one certification."""

    certification_title: Optional[str]
    strength: float
    delta_max_points: float
    delta: float
    score_after_cert: float

    def to_dict(self) -> Dict[str, Union[float, Optional[str]]]:
        return {
            "certification_title": self.certification_title,
            "strength": self.strength,
            "delta_max_points": self.delta_max_points,
            "delta": self.delta,
            "score_after_cert": self.score_after_cert,
        }


@dataclass(frozen=True)
class MultiEmployabilityResult:
    """Structured aggregated result for one or multiple certifications."""

    score_base: float
    total_delta: float
    score_final: float
    certifications: List[CertificationResult]

    def to_dict(self) -> Dict[str, Union[float, List[Dict[str, Union[float, Optional[str]]]]]]:
        return {
            "score_base": self.score_base,
            "total_delta": self.total_delta,
            "score_final": self.score_final,
            "certifications": [cert.to_dict() for cert in self.certifications],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------


class EmployabilityValidator:
    """Validates raw LLM JSON payload and score_base."""

    @staticmethod
    def validate(data: dict, score_base: float) -> EmployabilityInput:
        if not isinstance(data, dict):
            raise ValidationError("Input data must be a dictionary.")

        weights_raw = data.get("weights")
        if weights_raw is None:
            raise ValidationError("Missing required key: 'weights'.")

        delta_max = data.get("delta_max_points")
        if delta_max is None:
            raise ValidationError("Missing required key: 'delta_max_points'.")

        if not isinstance(weights_raw, dict):
            raise ValidationError("'weights' must be a dictionary.")

        weights: Dict[str, float] = {}
        for metier, valeur in weights_raw.items():
            if not isinstance(valeur, (int, float)):
                raise ValidationError(
                    f"Weight for '{metier}' must be numeric, got {type(valeur).__name__}."
                )
            val = float(valeur)
            if val not in ALLOWED_WEIGHTS:
                raise ValidationError(
                    f"Weight for '{metier}' is {val}; "
                    f"allowed values are {ALLOWED_WEIGHTS}."
                )
            weights[metier] = val

        if len(weights) != EXPECTED_METIER_COUNT:
            raise ValidationError(
                f"Expected exactly {EXPECTED_METIER_COUNT} weights, "
                f"got {len(weights)}."
            )

        if not isinstance(delta_max, (int, float)):
            raise ValidationError(
                f"'delta_max_points' must be numeric, got {type(delta_max).__name__}."
            )
        delta_max_float = float(delta_max)

        if not isinstance(score_base, (int, float)):
            raise ValidationError(
                f"'score_base' must be numeric, got {type(score_base).__name__}."
            )

        return EmployabilityInput(weights=weights, delta_max_points=delta_max_float)


def _extract_payloads(data: dict) -> List[dict]:
    """Accept either a single payload or a top-level {'results': [...]} payload."""
    if not isinstance(data, dict):
        raise ValidationError("Input data must be a dictionary.")

    if "weights" in data and "delta_max_points" in data:
        return [data]

    if "results" not in data:
        return [data]

    results = data.get("results")
    if not isinstance(results, list):
        raise ValidationError("'results' must be a list.")
    if not results:
        raise ValidationError("'results' list is empty.")

    payloads: List[dict] = []
    for idx, item in enumerate(results, start=1):
        if not isinstance(item, dict):
            raise ValidationError(
                f"Each item in 'results' must be a dictionary; item #{idx} is "
                f"{type(item).__name__}."
            )
        payloads.append(item)

    logger.info("Using %d entries from 'results' array in input JSON.", len(payloads))
    return payloads


def _extract_certification_title(payload: dict) -> Optional[str]:
    """Return certification title if available under certification_title or title."""
    for key in ("certification_title", "title"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None

# ---------------------------------------------------------------------------
# Calculator
# ---------------------------------------------------------------------------


class EmployabilityScoreCalculator:
    """Orchestrates the employability score computation."""

    def __init__(self, score_base: float, json_path: Union[str, Path]) -> None:
        self.score_base = float(score_base)
        self.json_path = Path(json_path)

    # ---------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------

    def calculate(self) -> MultiEmployabilityResult:
        payloads = _extract_payloads(self._load_json())
        certifications: List[CertificationResult] = []
        total_delta = 0.0

        for idx, payload in enumerate(payloads, start=1):
            validated = EmployabilityValidator.validate(payload, self.score_base)
            strength = self._compute_strength(validated.weights)
            delta = self._compute_delta(validated.delta_max_points, strength)
            score_after_cert = self.score_base + delta
            cert_title = _extract_certification_title(payload)

            logger.info(
                "cert_index=%d title=%s strength=%.4f delta_max=%.2f delta=%.2f score_after_cert=%.2f",
                idx,
                cert_title if cert_title is not None else "<untitled>",
                strength,
                validated.delta_max_points,
                delta,
                score_after_cert,
            )

            certifications.append(
                CertificationResult(
                    certification_title=cert_title,
                    strength=round(strength, 6),
                    delta_max_points=validated.delta_max_points,
                    delta=round(delta, 6),
                    score_after_cert=round(score_after_cert, 6),
                )
            )
            total_delta += delta

        score_final = self._compute_final_score(total_delta)
        logger.info(
            "score_base=%.2f certifications=%d total_delta=%.4f score_final=%.2f",
            self.score_base,
            len(certifications),
            total_delta,
            score_final,
        )

        return MultiEmployabilityResult(
            score_base=self.score_base,
            total_delta=round(total_delta, 6),
            score_final=round(score_final, 2),
            certifications=certifications,
        )

    # ---------------------------------------------------------------
    # Internal steps
    # ---------------------------------------------------------------

    def _load_json(self) -> dict:
        try:
            # Use utf-8-sig to transparently support files with UTF-8 BOM.
            with self.json_path.open("r", encoding="utf-8-sig") as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileReadError(f"File not found: {self.json_path}")
        except json.JSONDecodeError as exc:
            raise FileReadError(f"Invalid JSON in {self.json_path}: {exc}")

    def _compute_strength(self, weights: Dict[str, float]) -> float:
        sum_squares = sum(w * w for w in weights.values())
        return sum_squares / EXPECTED_METIER_COUNT

    def _compute_delta(self, delta_max_points: float, strength: float) -> float:
        return delta_max_points * strength

    def _compute_final_score(self, total_delta: float) -> float:
        return min(100.0, self.score_base + total_delta)

    # ---------------------------------------------------------------
    # Convenience
    # ---------------------------------------------------------------

    def save_result(self, result: MultiEmployabilityResult, output_path: Union[str, Path]) -> None:
        dest = Path(output_path)
        dest.write_text(result.to_json(), encoding="utf-8")
        logger.info("Result saved to %s", dest.resolve())

# ---------------------------------------------------------------------------
# Standalone entry point
# ---------------------------------------------------------------------------


def main() -> None:
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if len(sys.argv) == 3:
        try:
            score_base = float(sys.argv[1])
        except ValueError:
            logger.error("score_base must be a float, got '%s'", sys.argv[1])
            sys.exit(1)
        json_path = sys.argv[2]
    elif len(sys.argv) == 1:
        try:
            score_base = float(input("Enter score_base (e.g. 55): ").strip())
        except ValueError:
            logger.error("Invalid score_base. Please enter a numeric value.")
            sys.exit(1)
        json_path = DEFAULT_OUTPUT_JSON_PATH
    else:
        print("Usage: python score_employabilite_v2.py <score_base> <json_path>")
        print("Example: python score_employabilite_v2.py 55 output_llm.json")
        sys.exit(1)

    try:
        calculator = EmployabilityScoreCalculator(score_base=score_base, json_path=json_path)
        result = calculator.calculate()
        print(result.to_json())
    except EmployabilityError as exc:
        logger.error(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
