"""Recalculates workbooks with LibreOffice headless: every file in a folder is opened, calculated and saved again as
xlsx in an output folder, so openpyxl can read the values (data_only=True)."""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
import tempfile

CANDIDATES = [
    os.environ.get("SOFFICE", ""),
    r"C:\Program Files\LibreOffice\program\soffice.com",
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "/usr/bin/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
]


def soffice() -> str:
    for c in CANDIDATES:
        if c and os.path.exists(c):
            return c
    found = shutil.which("soffice") or shutil.which("libreoffice")
    if found:
        return found
    raise RuntimeError("LibreOffice was not found. Install it, or set SOFFICE to the path of soffice.")


def recalc_folder(src: str, out: str, timeout: int = 900, fmt: str = "xlsx") -> list[str]:
    """Recalculates every .xlsx in `src` into `out` (same file names). Returns the new paths."""
    os.makedirs(out, exist_ok=True)
    files = sorted(glob.glob(os.path.join(src, "*.xlsx")))
    if not files:
        return []
    profile = tempfile.mkdtemp(prefix="piy-lo-")  # its own profile: no clash with an open LibreOffice
    cmd = [soffice(), "--headless", "--norestore", "--nolockcheck", f"-env:UserInstallation=file:///{profile.replace(os.sep, '/')}",
           "--convert-to", fmt, "--outdir", out, *files]
    try:
        subprocess.run(cmd, check=True, timeout=timeout, capture_output=True)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    return sorted(glob.glob(os.path.join(out, f"*.{fmt.split(':')[0]}")))
