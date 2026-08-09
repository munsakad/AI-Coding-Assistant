"""
Trains the bug-risk MLP on a SYNTHETIC dataset, since there's no bundled
real-world labeled corpus. The synthetic labels come from an explicit risk
formula over the same structural features the model consumes at inference
time (deeper nesting, higher branch density, more magic numbers and empty
catch blocks -> higher risk; more comments, lower risk) plus Gaussian noise
so the model has to actually learn a boundary rather than memorize a
deterministic rule.

This is a legitimate way to bootstrap a real, working model for a demo/v1
— it's not pretending to reflect real-world bug statistics. Swap in a real
labeled dataset (e.g. bug-fix commits mapped to pre-fix snippets) later by
replacing `generate_synthetic_dataset` with a loader and keeping everything
else the same.

Run: python train.py   (from the backend/ directory, inside your venv)
"""
import numpy as np
import torch
import torch.nn as nn

from model.network import BugRiskNet, INPUT_DIM

SEED = 42
N_SAMPLES = 6000
EPOCHS = 60
BATCH_SIZE = 64
LR = 1e-3


def generate_synthetic_dataset(n: int, seed: int = SEED):
    rng = np.random.default_rng(seed)

    line_count = rng.uniform(5, 400, n)
    avg_line_length = rng.uniform(10, 120, n)
    max_indent_depth = rng.integers(0, 12, n).astype(np.float32)
    branch_density = rng.uniform(0, 1.5, n)
    comment_ratio = rng.uniform(0, 0.4, n)
    todo_count = rng.poisson(0.5, n).astype(np.float32)
    magic_number_density = rng.uniform(0, 0.5, n)
    empty_catch_count = rng.poisson(0.15, n).astype(np.float32)
    bare_except_count = rng.poisson(0.1, n).astype(np.float32)
    avg_function_length = rng.uniform(3, 150, n)

    X = np.stack(
        [
            line_count,
            avg_line_length,
            max_indent_depth,
            branch_density,
            comment_ratio,
            todo_count,
            magic_number_density,
            empty_catch_count,
            bare_except_count,
            avg_function_length,
        ],
        axis=1,
    ).astype(np.float32)

    # Risk formula: normalize each contributing factor roughly to [0, ~1]
    # before summing, so no single feature's raw scale dominates.
    risk_logit = (
        0.9 * (max_indent_depth / 12)
        + 0.8 * np.clip(branch_density / 1.5, 0, 1)
        + 0.7 * np.clip(magic_number_density / 0.5, 0, 1)
        + 1.2 * np.clip(empty_catch_count / 2, 0, 1)
        + 1.0 * np.clip(bare_except_count / 2, 0, 1)
        + 0.5 * np.clip(avg_function_length / 150, 0, 1)
        + 0.4 * np.clip(todo_count / 3, 0, 1)
        - 1.1 * np.clip(comment_ratio / 0.4, 0, 1)
        - 2.0  # bias so an "average" snippet lands near low-moderate risk
    )
    noise = rng.normal(0, 0.6, n)
    prob = 1 / (1 + np.exp(-(risk_logit + noise)))
    y = (prob > 0.5).astype(np.float32)

    # Standardize features (store mean/std for use at inference time).
    mean = X.mean(axis=0)
    std = X.std(axis=0) + 1e-6
    X_norm = (X - mean) / std

    return X_norm, y.reshape(-1, 1), mean, std


def train():
    torch.manual_seed(SEED)
    X, y, mean, std = generate_synthetic_dataset(N_SAMPLES)

    n_val = int(N_SAMPLES * 0.15)
    X_train, X_val = X[n_val:], X[:n_val]
    y_train, y_val = y[n_val:], y[:n_val]

    X_train_t = torch.from_numpy(X_train)
    y_train_t = torch.from_numpy(y_train)
    X_val_t = torch.from_numpy(X_val)
    y_val_t = torch.from_numpy(y_val)

    model = BugRiskNet(input_dim=INPUT_DIM)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.BCELoss()

    n_train = X_train_t.shape[0]
    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(n_train)
        epoch_loss = 0.0
        for i in range(0, n_train, BATCH_SIZE):
            idx = perm[i : i + BATCH_SIZE]
            xb, yb = X_train_t[idx], y_train_t[idx]
            optimizer.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * xb.size(0)

        if (epoch + 1) % 10 == 0 or epoch == EPOCHS - 1:
            model.eval()
            with torch.no_grad():
                val_pred = model(X_val_t)
                val_acc = ((val_pred > 0.5).float() == y_val_t).float().mean().item()
            print(f"epoch {epoch + 1:3d}/{EPOCHS}  train_loss={epoch_loss / n_train:.4f}  val_acc={val_acc:.3f}")

    torch.save(
        {"state_dict": model.state_dict(), "mean": mean, "std": std},
        "model/weights.pt",
    )
    print("Saved model/weights.pt")


if __name__ == "__main__":
    train()
