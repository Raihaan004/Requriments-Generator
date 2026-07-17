import re
import unicodedata

# Pre-compiled regular expression to split sentences at '.', ';', or '?' followed by whitespace.
# It uses negative lookbehinds to prevent splitting on common abbreviations, initials, or decimals.
# Since python's standard 're' module requires fixed-width lookbehinds, each prefix check is declared individually.
SPLIT_REGEX = re.compile(
    r'(?<!\b[eE]\.[gG]\.)'    # Negative lookbehind: e.g.
    r'(?<!\b[iI]\.[eE]\.)'    # Negative lookbehind: i.e.
    r'(?<!\b[eE]tc\.)'        # Negative lookbehind: etc.
    r'(?<!\b[aA]pprox\.)'     # Negative lookbehind: approx.
    r'(?<!\b[vV]s\.)'         # Negative lookbehind: vs.
    r'(?<!\b[fF]ig\.)'        # Negative lookbehind: fig.
    r'(?<!\b[nN]o\.)'         # Negative lookbehind: no.
    r'(?<!\b[rR]ef\.)'        # Negative lookbehind: ref.
    r'(?<!\b[aA]l\.)'         # Negative lookbehind: al. (et al.)
    r'(?<!\b[sS]ec\.)'        # Negative lookbehind: sec.
    r'(?<!\b[mM]in\.)'        # Negative lookbehind: min.
    r'(?<!\b[mM]ax\.)'        # Negative lookbehind: max.
    r'(?<!\b[dD]ept\.)'       # Negative lookbehind: dept.
    r'(?<!\b[uU]niv\.)'       # Negative lookbehind: univ.
    r'(?<!\b[cC]h\.)'         # Negative lookbehind: ch.
    r'(?<!\b[vV]ol\.)'        # Negative lookbehind: vol.
    r'(?<!\b[sS]td\.)'        # Negative lookbehind: std.
    r'(?<!\b[tT]emp\.)'       # Negative lookbehind: temp.
    r'(?<=[.?;])'             # Positive lookbehind: split immediately *after* the punctuation
    r'\s+'                    # Split on one or more whitespace characters
)

def is_pure_numeric(s: str) -> bool:
    """
    Returns True if the string, ignoring all whitespace, consists entirely of digits.
    """
    cleaned = "".join(s.split())
    return cleaned.isdigit() if cleaned else False

def is_pure_punctuation(s: str) -> bool:
    """
    Returns True if the string, ignoring all whitespace, consists entirely of punctuation or symbols.
    Uses Unicode character categories (Punctuation 'P', Symbol 'S') for robust checking.
    """
    cleaned = "".join(s.split())
    if not cleaned:
        return False
    return all(unicodedata.category(c).startswith(('P', 'S')) for c in cleaned)

def split_statements(text: str, source_doc: str) -> list[dict]:
    """
    Splits plain text input into a clean list of individual "requirement candidate" statement objects.
    
    Each returned dict has this exact shape:
    {
        "text": str,           # the cleaned statement text
        "source_doc": str,     # passed-through source_doc argument
        "line_number": int     # approximate line/position in the original text (1-indexed)
    }
    
    Processing logic:
    1. Split input text into lines (text.split("\n"))
    2. For each line:
       - Strip leading/trailing whitespace
       - Skip if resulting line is under 15 characters
       - Skip if line is purely numeric or purely punctuation/symbols
    3. Within each surviving line, further split on sentence boundaries using SPLIT_REGEX
    4. Re-strip each resulting sentence and re-apply filters (length >= 15, not numeric, not punctuation)
    5. Track line_number as the index of the original line in the input (1-indexed)
    6. Deduplicate identical text candidates within the scope of the same source_doc (keeping the first occurrence)
    """
    if not text:
        return []

    lines = text.split("\n")
    candidates = []
    seen = set()

    for idx, line in enumerate(lines):
        line_num = idx + 1
        stripped_line = line.strip()

        # Apply line level filters
        if len(stripped_line) < 15:
            continue
        if is_pure_numeric(stripped_line):
            continue
        if is_pure_punctuation(stripped_line):
            continue

        # Split line on sentence boundaries
        sentences = SPLIT_REGEX.split(stripped_line)

        for sentence in sentences:
            stripped_sentence = sentence.strip()

            # Re-apply filters on the resulting sentence candidates
            if len(stripped_sentence) < 15:
                continue
            if is_pure_numeric(stripped_sentence):
                continue
            if is_pure_punctuation(stripped_sentence):
                continue

            # Deduplicate locally within the source document
            if stripped_sentence in seen:
                continue
            seen.add(stripped_sentence)

            candidates.append({
                "text": stripped_sentence,
                "source_doc": source_doc,
                "line_number": line_num
            })

    return candidates
