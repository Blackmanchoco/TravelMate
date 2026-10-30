"""Check the exported report against captured aggregate API values and render every page."""
import json
import re
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[2] / "docs/freeze-plan/admin-report/headless"
pdf = root / "admin-report.pdf"
expected = json.loads((root / "expected.json").read_text(encoding="utf-8"))
reader = PdfReader(pdf)
text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
(root / "admin-report.txt").write_text(text, encoding="utf-8")
normalized = re.sub(r"\s+", " ", text)
checks = {}
checks["generationTime"] = re.sub(r"\s+", " ", expected["generatedLabel"]) in normalized
for label, key in [("Discoverable places", "discoverable"), ("Archived places", "archived"), ("Test fixtures", "test")]:
    checks[label] = f'{label} {expected["totals"][key]}' in normalized
for row in expected["byDestination"]:
    checks["destination:" + row["name"]] = f'{row["name"]} {row["discoverable"]} {row["archived"]}' in normalized
for row in expected["byCategory"]:
    checks["category:" + row["category"]] = f'{row["category"]} {row["count"]}' in normalized
checks["auditSummary"] = f'{expected["auditSummary"]["total"]} recorded actions across the retained audit log.' in normalized
for row in expected["auditSummary"]["byAction"]:
    checks["audit:" + row["action"]] = f'{row["action"]} {row["count"]}' in normalized
checks["noEmailsOrUserIds"] = not re.search(r'[^\s@]+@[^\s@]+\.[^\s@]+|\b(?:userId|adminUserId)\b|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', text, re.I)
sizes = [{"widthMm": round(float(p.mediabox.width) * 25.4 / 72, 2), "heightMm": round(float(p.mediabox.height) * 25.4 / 72, 2)} for p in reader.pages]
checks["A4"] = all(abs(p["widthMm"] - 210) < 1 and abs(p["heightMm"] - 297) < 1 for p in sizes)
report = {"pageCount": len(reader.pages), "sizeBytes": pdf.stat().st_size, "pageSizes": sizes, "checks": checks}
(root / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
document = pdfium.PdfDocument(str(pdf))
for index in range(len(document)):
    document[index].render(scale=1.5).to_pil().save(root / f"page-{index + 1}.png")
print(json.dumps(report, indent=2))
if not all(checks.values()):
    raise SystemExit("PDF content check failed")
