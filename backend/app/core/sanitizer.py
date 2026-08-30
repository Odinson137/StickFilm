import re

REPLACEMENTS = [
    (r"\bSpider[- ]?Man\s*\d*\b", "masked stick figure hero in red-blue suit"),
    (r"\bSpiderman\s*\d*\b", "masked stick figure hero"),
    (r"\bPeter\s*Parker\b", "stick figure boy with round glasses"),
    (r"\bPeter\b", "stick figure hero"),
    (r"\bDoc\s*Ock\b", "stick figure scientist with 4 mechanical tentacles"),
    (r"\bDoctor\s*Octopus\b", "stick figure scientist with tentacles"),
    (r"\bOtto\s*Octavius\b", "mad scientist stick figure"),
    (r"\bOtto\b", "scientist stick figure"),
    (r"\bVenom\b", "giant monstrous black gooey creature with jagged teeth"),
    (r"\bSandman\b", "giant crumbling sand monster stick figure"),
    (r"\bGreen\s*Goblin\b", "flying glider villain stick figure"),
    (r"\bGoblin\b", "glider villain"),
    (r"\bHarry\s*Osborn\b", "rich rival stick figure"),
    (r"\bHarry\b", "rival stickman"),
    (r"\bAunt\s*May\b", "elderly grandma stick figure"),
    (r"\bMary\s*Jane\b", "stick figure girlfriend"),
    (r"\bMJ\b", "stick figure girlfriend"),
    (r"\bMarvel\b", "comic book"),
    (r"\bBatman\b", "masked bat hero stick figure"),
    (r"\bSuperman\b", "flying cape hero stick figure"),
    (r"\bJoker\b", "clown villain stick figure"),
    (r"\bAvengers\b", "superhero squad stick figures"),
]

def sanitize_prompt(prompt: str) -> str:
    cleaned = prompt
    for pattern, replacement in REPLACEMENTS:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    # Remove any leftover trademark keywords
    cleaned = re.sub(r"\b(Sony|Disney|Paramount|Warner\s*Bros|DC\s*Comics)\b", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()
