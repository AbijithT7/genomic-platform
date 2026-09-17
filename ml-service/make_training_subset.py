import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent
INPUT = BASE / "data" / "clinvar_labels.csv"
OUTPUT = BASE / "data" / "training_subset.csv"

N_PER_CLASS = 25_000

print("Loading ClinVar dataset...")

df = pd.read_csv(
    INPUT,
    low_memory=False
)

# Keep only clearly labelled variants.
pathogenic = df[df["label"] == 1]
benign = df[df["label"] == 0]

print(f"Pathogenic available: {len(pathogenic):,}")
print(f"Benign available:     {len(benign):,}")

# Reproducible random sample.
pathogenic = pathogenic.sample(
    n=min(N_PER_CLASS, len(pathogenic)),
    random_state=42
)

benign = benign.sample(
    n=min(N_PER_CLASS, len(benign)),
    random_state=42
)

subset = pd.concat(
    [pathogenic, benign],
    ignore_index=True
)

# Shuffle the final dataset.
subset = subset.sample(
    frac=1,
    random_state=42
).reset_index(drop=True)

subset.to_csv(
    OUTPUT,
    index=False
)

print()
print("===================================")
print("Training subset created")
print("===================================")
print(f"Total variants: {len(subset):,}")
print(f"Pathogenic:     {(subset['label'] == 1).sum():,}")
print(f"Benign:         {(subset['label'] == 0).sum():,}")
print(f"Output:         {OUTPUT}")
print("===================================")