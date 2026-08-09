import os
import torch
import numpy as np

from .network import BugRiskNet
from .features import extract_features

WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights.pt")

_model: BugRiskNet | None = None
_mean: np.ndarray | None = None
_std: np.ndarray | None = None


class ModelNotTrainedError(Exception):
    pass


def _load():
    global _model, _mean, _std
    if _model is not None:
        return
    if not os.path.exists(WEIGHTS_PATH):
        raise ModelNotTrainedError(
            "model/weights.pt not found — run `python train.py` from the backend/ "
            "directory once (inside your venv) to train and save the model."
        )
    checkpoint = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=False)
    model = BugRiskNet()
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    _model = model
    _mean = checkpoint["mean"]
    _std = checkpoint["std"]


def score_risk(code: str) -> dict:
    """Returns a bug-risk score in [0, 100] plus the raw feature readout,
    so the frontend can show *why* (e.g. "max nesting depth: 6") rather
    than just a bare number."""
    _load()
    features = extract_features(code)
    normalized = (features - _mean) / _std
    with torch.no_grad():
        x = torch.from_numpy(normalized.astype(np.float32)).unsqueeze(0)
        prob = _model(x).item()

    from .features import FEATURE_NAMES

    return {
        "risk_score": round(prob * 100, 1),
        "features": {name: round(float(val), 3) for name, val in zip(FEATURE_NAMES, features)},
    }
