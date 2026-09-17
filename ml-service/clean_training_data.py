import pandas as pd
from pathlib import Path


BASE = Path(__file__).parent

INPUT_FILE = BASE / "data" / "final_training_data.csv"
OUTPUT_FILE = BASE / "data" / "model_training_data.csv"

RANDOM_STATE = 42


def main():

    print("Loading final training dataset...")

    df = pd.read_csv(
        INPUT_FILE,
        low_memory=False
    )

    print(f"Original variants: {len(df):,}")

    # ---------------------------------------------------------
    # 1. Keep only clean ClinVar classifications
    # ---------------------------------------------------------

    pathogenic_labels = {
        "Pathogenic",
        "Likely_pathogenic",
        "Pathogenic/Likely_pathogenic"
    }

    benign_labels = {
        "Benign",
        "Likely_benign",
        "Benign/Likely_benign"
    }

    df = df[
        df["clinvar_significance"].isin(
            pathogenic_labels | benign_labels
        )
    ].copy()

    print(f"After label cleaning: {len(df):,}")

    # ---------------------------------------------------------
    # 2. Create explicit binary labels
    # ---------------------------------------------------------

    df["label"] = df["clinvar_significance"].apply(
        lambda x: 1 if x in pathogenic_labels else 0
    )

    # ---------------------------------------------------------
    # 3. Show class distribution
    # ---------------------------------------------------------

    pathogenic = df[df["label"] == 1]
    benign = df[df["label"] == 0]

    print(f"Pathogenic available: {len(pathogenic):,}")
    print(f"Benign available:     {len(benign):,}")

    # ---------------------------------------------------------
    # 4. Balance the dataset
    # ---------------------------------------------------------

    n = min(
        len(pathogenic),
        len(benign)
    )

    pathogenic = pathogenic.sample(
        n=n,
        random_state=RANDOM_STATE
    )

    benign = benign.sample(
        n=n,
        random_state=RANDOM_STATE
    )

    balanced = pd.concat(
        [pathogenic, benign],
        ignore_index=True
    )

    # Shuffle final dataset.
    balanced = balanced.sample(
        frac=1,
        random_state=RANDOM_STATE
    ).reset_index(drop=True)

    # ---------------------------------------------------------
    # 5. Keep only useful ML columns
    # ---------------------------------------------------------

    balanced = balanced[
        [
            "chrom",
            "pos",
            "ref",
            "alt",
            "variation_id",
            "clinvar_significance",
            "allele_frequency",
            "cadd_score",
            "label"
        ]
    ]

    # ---------------------------------------------------------
    # 6. Save
    # ---------------------------------------------------------

    balanced.to_csv(
        OUTPUT_FILE,
        index=False
    )

    # ---------------------------------------------------------
    # 7. Final report
    # ---------------------------------------------------------

    print()
    print("===================================")
    print("CLEAN BALANCED DATASET")
    print("===================================")
    print(f"Total variants: {len(balanced):,}")
    print(
        f"Pathogenic:     {(balanced['label'] == 1).sum():,}"
    )
    print(
        f"Benign:         {(balanced['label'] == 0).sum():,}"
    )
    print()
    print(f"Output:")
    print(OUTPUT_FILE)
    print("===================================")


if __name__ == "__main__":
    main()