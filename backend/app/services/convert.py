import subprocess
from pathlib import Path


def convert_to_pdf(input_path: Path, output_pdf_path: Path) -> bool:
    if input_path.suffix.lower() == ".pdf":
        return True
    # Try LibreOffice headless conversion
    try:
        subprocess.run(
            [
                "soffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_pdf_path.parent),
                str(input_path),
            ],
            check=True,
        )
        produced = input_path.with_suffix(".pdf")
        if produced.exists():
            produced.rename(output_pdf_path)
            return True
    except Exception:
        return False
    return output_pdf_path.exists()



