import gzip
import io
from pathlib import Path

import pandas as pd


BASE = Path(__file__).parent

CLINVAR_FILE = BASE / "data" / "training_subset.csv"
CADD_FILE = BASE / "data" / "cadd_results.tsv.gz"
OUTPUT_FILE = BASE / "data" / "final_training_data.csv"


def main():
    # ---------------------------------------------------------
    # 1. Load ClinVar training subset
    # ---------------------------------------------------------

    print("Loading ClinVar training subset...")

    clinvar = pd.read_csv(
        CLINVAR_FILE,
        low_memory=False
    )

    # Keep SNVs only.
    clinvar = clinvar[
        (clinvar["ref"].astype(str).str.len() == 1) &
        (clinvar["alt"].astype(str).str.len() == 1)
    ].copy()

    # Normalize chromosome names.
    clinvar["chrom"] = (
        clinvar["chrom"]
        .astype(str)
        .str.replace("chr", "", regex=False)
    )

    clinvar["pos"] = pd.to_numeric(
        clinvar["pos"],
        errors="coerce"
    )

    clinvar["ref"] = clinvar["ref"].astype(str).str.upper()
    clinvar["alt"] = clinvar["alt"].astype(str).str.upper()

    print(f"ClinVar SNVs: {len(clinvar):,}")

    # ---------------------------------------------------------
    # 2. Load CADD results
    # ---------------------------------------------------------

    print("Loading CADD results...")

    # CADD has metadata lines beginning with ##.
    # The actual header begins with #Chrom.
    with gzip.open(CADD_FILE, "rt", encoding="utf-8") as f:

        header = None

        for line in f:
            if line.startswith("#Chrom"):
                header = line.lstrip("#").strip().split("\t")
                break

        if header is None:
            raise ValueError(
                "Could not find the CADD header (#Chrom...)."
            )

        # Read the remaining variant rows.
        remaining_data = f.read()

    cadd = pd.read_csv(
        io.StringIO(remaining_data),
        sep="\t",
        names=header,
        low_memory=False
    )

    print(f"CADD records: {len(cadd):,}")
    print(f"CADD columns: {list(cadd.columns)}")

    # ---------------------------------------------------------
    # 3. Normalize CADD data
    # ---------------------------------------------------------

    required_columns = [
        "Chrom",
        "Pos",
        "Ref",
        "Alt",
        "PHRED"
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in cadd.columns
    ]

    if missing_columns:
        raise ValueError(
            f"CADD file is missing columns: {missing_columns}"
        )

    cadd["Chrom"] = (
        cadd["Chrom"]
        .astype(str)
        .str.replace("chr", "", regex=False)
    )

    cadd["Pos"] = pd.to_numeric(
        cadd["Pos"],
        errors="coerce"
    )

    cadd["Ref"] = cadd["Ref"].astype(str).str.upper()
    cadd["Alt"] = cadd["Alt"].astype(str).str.upper()

    cadd["PHRED"] = pd.to_numeric(
        cadd["PHRED"],
        errors="coerce"
    )

    # Rename columns so they match ClinVar.
    cadd = cadd.rename(columns={
        "Chrom": "chrom",
        "Pos": "pos",
        "Ref": "ref",
        "Alt": "alt",
        "PHRED": "cadd_score"
    })

    cadd = cadd[
        [
            "chrom",
            "pos",
            "ref",
            "alt",
            "cadd_score"
        ]
    ].copy()

    # Remove rows without a valid CADD score.
    cadd = cadd.dropna(
        subset=["chrom", "pos", "ref", "alt", "cadd_score"]
    )

    # ---------------------------------------------------------
    # 4. Merge ClinVar + CADD
    # ---------------------------------------------------------

    print("Merging ClinVar and CADD...")

    merged = clinvar.merge(
        cadd,
        on=[
            "chrom",
            "pos",
            "ref",
            "alt"
        ],
        how="inner"
    )

    print()
    print("===================================")
    print("CADD merge completed")
    print("===================================")
    print(f"ClinVar SNVs:     {len(clinvar):,}")
    print(f"CADD records:     {len(cadd):,}")
    print(f"Matched variants: {len(merged):,}")
    print("===================================")

    # ---------------------------------------------------------
    # 5. Prepare allele-frequency features
    # ---------------------------------------------------------

    print()
    print("Preparing allele-frequency feature...")

    af_columns = [
        "af_esp",
        "af_exac",
        "af_tgp"
    ]

    for column in af_columns:
        merged[column] = pd.to_numeric(
            merged[column],
            errors="coerce"
        )

    # Use the lowest available population frequency.
    #
    # If a variant has:
    # AF_ESP  = 0.001
    # AF_EXAC = 0.0002
    # AF_TGP  = missing
    #
    # allele_frequency = 0.0002
    merged["allele_frequency"] = merged[
        af_columns
    ].min(
        axis=1,
        skipna=True
    )

    # ---------------------------------------------------------
    # 6. Remove rows missing required ML features
    # ---------------------------------------------------------

    before_filter = len(merged)

    final = merged.dropna(
        subset=[
            "cadd_score",
            "allele_frequency",
            "label"
        ]
    ).copy()

    removed = before_filter - len(final)

    print(f"Variants before feature filtering: {before_filter:,}")
    print(f"Variants removed:                  {removed:,}")
    print(f"Variants remaining:                {len(final):,}")

    # ---------------------------------------------------------
    # 7. Keep only the fields needed for ML
    # ---------------------------------------------------------

    final = final[
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
    ].copy()

    # Make sure labels are integers.
    final["label"] = final["label"].astype(int)

    # ---------------------------------------------------------
    # 8. Save final dataset
    # ---------------------------------------------------------

    final.to_csv(
        OUTPUT_FILE,
        index=False
    )

    # ---------------------------------------------------------
    # 9. Final statistics
    # ---------------------------------------------------------

    pathogenic_count = (
        final["label"] == 1
    ).sum()

    benign_count = (
        final["label"] == 0
    ).sum()

    print()
    print("===================================")
    print("FINAL ML DATASET")
    print("===================================")
    print(f"Total variants: {len(final):,}")
    print(f"Pathogenic:     {pathogenic_count:,}")
    print(f"Benign:         {benign_count:,}")
    print()
    print(f"Saved to:")
    print(OUTPUT_FILE)
    print("===================================")


if __name__ == "__main__":
    main()