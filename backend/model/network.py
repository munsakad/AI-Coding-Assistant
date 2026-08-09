import torch
import torch.nn as nn

from .features import FEATURE_NAMES

INPUT_DIM = len(FEATURE_NAMES)


class BugRiskNet(nn.Module):
    """Small feed-forward net: structural features -> bug-risk probability.

    Deliberately tiny (this isn't trying to compete with the LLM on
    semantics) — it's a fast, consistent, independent second opinion, per
    the whiteboard: never blended with Gemini's findings, always shown
    alongside them.
    """

    def __init__(self, input_dim: int = INPUT_DIM, hidden_dim: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)
