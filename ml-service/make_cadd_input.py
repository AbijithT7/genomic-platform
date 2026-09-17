import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent
INPUT = BASE / "data" / "training_subset.csv"
OUTPUT = BASE / "data" / "cadd_input.vcf"

df = pd.read_csv(INPUT, low_memory=False)

# Keep SNVs only
df = df[
    (df["ref"].str.len() == 1) &
    (df["alt"].str.len() == 1)
].copy()

# Normalize chromosome representation.
df["chrom"] = df["chrom"].astype(str).str.replace("chr", "", regex=False)

with open(OUTPUT, "w") as f:
    f.write("##fileformat=VCFv4.2\n")
    f.write("##reference=GRCh37\n")
    f.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n")

    for _, row in df.iterrows():
        f.write(
            f"{row['chrom']}\t"
            f"{int(row['pos'])}\t"
            f"{row['variation_id']}\t"
            f"{row['ref']}\t"
            f"{row['alt']}\t"
            f".\tPASS\t.\n"
        )

print(f"SNVs written: {len(df):,}")
print(f"Output: {OUTPUT}")