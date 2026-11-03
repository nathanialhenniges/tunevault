#!/usr/bin/env python3
"""Check important text contrast pairs from the prototype's actual CSS tokens."""

import re
from pathlib import Path


def declarations(css, selector):
    match = re.search(re.escape(selector) + r"\{([^}]+)\}", css)
    assert match, f"Missing CSS selector: {selector}"
    return dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", match[1]))


def luminance(color):
    color = {"white": "#ffffff", "black": "#000000"}.get(color, color)
    if re.fullmatch(r"#[0-9a-fA-F]{3}", color):
        color = "#" + "".join(c * 2 for c in color[1:])
    assert re.fullmatch(r"#[0-9a-fA-F]{6}", color), f"Unsupported color: {color}"
    channels = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return sum(c * weight for c, weight in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(foreground, background):
    darker, lighter = sorted((luminance(foreground), luminance(background)))
    return (lighter + 0.05) / (darker + 0.05)


def main():
    path = Path(__file__).resolve().parents[1] / "docs" / "interface-preview.html"
    css = path.read_text().split("<style>", 1)[1].split("</style>", 1)[0]
    base = declarations(css, ":root")
    pairs = (("ink", "bg"), ("muted", "surface"), ("muted", "chrome"),
             ("ink", "selected"), ("muted", "selected"), ("accent", "bg"),
             ("warn", "surface"))
    failures = []
    checked = 0
    for mode in ("light", "dark"):
        for accent in ("blue", "orange"):
            tokens = base | (declarations(css, "body.dark") if mode == "dark" else {})
            if accent == "orange":
                tokens |= declarations(css, "body[data-accent=orange]")
                if mode == "dark":
                    tokens |= declarations(css, "body.dark[data-accent=orange]")
            name = f"{mode}/{accent}"
            for foreground, background in pairs + (("primary-text", "primary"), ("primary-text", "primary-hover")):
                ratio = contrast(tokens[f"--{foreground}"], tokens[f"--{background}"])
                print(f"{name}: {foreground}/{background} {ratio:.2f}:1")
                checked += 1
                if ratio < 4.5:
                    failures.append(f"{name}: {foreground}/{background}")
    assert not failures, "Text contrast below 4.5:1: " + ", ".join(failures)
    print(f"{checked} text/state pairs passed across four appearance/accent combinations. Rendered and assistive-technology checks remain separate.")


if __name__ == "__main__":
    main()
