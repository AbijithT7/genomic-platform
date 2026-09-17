import gzip
import csv
from pathlib import Path


INPUT_FILE = Path(__file__).parent / "data" / "clinvar_20260905.vcf.gz"
OUTPUT_FILE = Path(__file__).parent / "data" / "clinvar_labels.csv"


def parse_info(info_string):
    """Convert VCF INFO column into a dictionary."""
    info = {}

    for item in info_string.split(";"):
        if "=" in item:
            key, value = item.split("=", 1)
            info[key] = value
        else:
            info[item] = True

    return info


def get_label(clnsig):
    """
    Convert ClinVar clinical significance into a binary label.

    1 = Pathogenic / Likely pathogenic
    0 = Benign / Likely benign
    None = ambiguous / unusable
    """

    if not clnsig:
        return None

    value = clnsig.lower()

    # Remove extra formatting that can appear in the VCF.
    value = value.replace("_", " ").replace("-", " ")

    if "conflicting" in value:
        return None

    if "pathogenic" in value:
        if "likely pathogenic" in value or value.strip() == "pathogenic":
            return 1

    if "benign" in value:
        if "likely benign" in value or value.strip() == "benign":
            return 0

    return None


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Could not find ClinVar file:\n{INPUT_FILE}"
        )

    total = 0
    kept = 0
    pathogenic = 0
    benign = 0

    with gzip.open(INPUT_FILE, "rt", encoding="utf-8") as infile, \
         open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as outfile:

        writer = csv.writer(outfile)

        writer.writerow([
            "chrom",
            "pos",
            "ref",
            "alt",
            "variation_id",
            "allele_id",
            "clinvar_significance",
            "af_esp",
            "af_exac",
            "af_tgp",
            "label"
        ])

        for line in infile:

            if line.startswith("#"):
                continue

            total += 1

            fields = line.rstrip("\n").split("\t")

            if len(fields) < 8:
                continue

            chrom = fields[0]
            pos = fields[1]
            variation_id = fields[2]
            ref = fields[3]
            alt = fields[4]
            info_string = fields[7]

            info = parse_info(info_string)

            clnsig = info.get("CLNSIG")
            allele_id = info.get("ALLELEID", "")

            af_esp = info.get("AF_ESP", "")
            af_exac = info.get("AF_EXAC", "")
            af_tgp = info.get("AF_TGP", "")

            label = get_label(clnsig)

            if label is None:
                continue

            # Skip multi-allelic records for this first dataset.
            if "," in alt:
                continue
            writer.writerow([
                chrom,
                pos,
                ref,
                alt,
                variation_id,
                allele_id,
                clnsig,
                af_esp,
                af_exac,
                af_tgp,
                label
            ])


            kept += 1

            if label == 1:
                pathogenic += 1
            else:
                benign += 1

    print()
    print("===================================")
    print("ClinVar dataset preparation")
    print("===================================")
    print(f"Total VCF records:       {total:,}")
    print(f"Usable labelled records: {kept:,}")
    print(f"Pathogenic:              {pathogenic:,}")
    print(f"Benign:                  {benign:,}")
    print()
    print(f"Output: {OUTPUT_FILE}")
    print("===================================")


if __name__ == "__main__":
    main()