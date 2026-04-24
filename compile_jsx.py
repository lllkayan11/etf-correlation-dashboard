from pathlib import Path

import dukpy


BASE_DIR = Path("/Applications/Google Chrome.app/etf-correlation-pages")
SRC_PATH = BASE_DIR / "etf-correlation-dashboard.jsx"
OUT_PATH = BASE_DIR / "app.compiled.js"


def main() -> None:
    source = SRC_PATH.read_text(encoding="utf-8")
    # Babel classic runtime needs React symbol in scope.
    if 'from "react";' in source and 'import React from "react";' not in source:
        source = 'import React from "react";\n' + source

    result = dukpy.babel_compile(
        source,
        presets=["react"],
        plugins=["transform-object-rest-spread"],
    )
    code = result["code"]
    OUT_PATH.write_text(code, encoding="utf-8")
    print(f"Compiled JS written: {OUT_PATH}")


if __name__ == "__main__":
    main()
