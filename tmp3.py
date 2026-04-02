from pathlib import Path
lines = Path('functions/index.js').read_text().splitlines()
for i, line in enumerate(lines, 1):
    if 540 <= i <= 640:
        print(f"{i}:{line}")
