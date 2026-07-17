import re

def classify_statement(statement_text: str, rules: dict) -> dict:
    """
    Classifies a single statement using deterministic rule-based matching.
    
    Matches keywords (case-insensitive substring) and regex patterns (using re.search
    against the original statement text).
    
    :param statement_text: The requirement statement string.
    :param rules: The rule taxonomy dict containing category patterns and weights.
    :return: A dictionary mapping matched categories to matched patterns and score.
             Categories with 0 matches are omitted from the output.
    """
    classification = {}
    statement_lower = statement_text.lower()
    
    for category, content in rules.items():
        matched_items = []
        score = 0
        weight = content.get("weight", 1)
        
        # Check keywords
        for kw in content.get("keywords", []):
            if kw in statement_lower:
                matched_items.append(kw)
                score += weight
                
        # Check regex patterns (on original text to preserve flag modifiers like (?i))
        for pattern in content.get("regex", []):
            if re.search(pattern, statement_text):
                matched_items.append(f"regex:{pattern}")
                score += weight
                
        if matched_items:
            classification[category] = {
                "matched": matched_items,
                "score": score
            }
            
    return classification


def filter_by_threshold(classification: dict, min_score: int = 1) -> dict:
    """
    Removes any category from the classification result whose score is below min_score.
    
    :param classification: The dictionary returned by classify_statement.
    :param min_score: The minimum score threshold (default is 1).
    :return: A new filtered classification dictionary.
    """
    return {
        category: details
        for category, details in classification.items()
        if details.get("score", 0) >= min_score
    }


def classify_batch(statements: list[dict], rules: dict, min_score: int = 1) -> list[dict]:
    """
    Classifies a batch of statement objects, applying threshold filtering.
    
    :param statements: A list of dicts with {"text": str, "source_doc": str, "line_number": int}.
    :param rules: The rules taxonomy dict.
    :param min_score: The minimum classification score threshold.
    :return: A list of dicts including the original keys and a new "classification" key.
    """
    classified_statements = []
    for stmt in statements:
        raw_classification = classify_statement(stmt["text"], rules)
        filtered_classification = filter_by_threshold(raw_classification, min_score)
        
        classified_statements.append({
            "text": stmt["text"],
            "source_doc": stmt["source_doc"],
            "line_number": stmt["line_number"],
            "classification": filtered_classification
        })
    return classified_statements


def merge_user_rules(base_rules: dict, rules_text: str) -> dict:
    """
    Parses custom rules from rules_text and merges them into a copy of base_rules.
    Each non-empty line of rules_text should start with a category name followed by ':' or '='.
    The remaining text on that line is split by commas to extract keywords or regexes.
    Keywords are lowercased and added to content['keywords'].
    If a term starts with 'regex:', the prefix is stripped and it is compiled/added to content['regex'].
    
    Example:
    Functionality: Bluetooth, wifi, shall support OTA
    Fault Management: regex:\\bshort\\s*circuit\\b
    """
    import copy
    import re
    
    merged = copy.deepcopy(base_rules)
    if not rules_text:
        return merged
        
    category_map = {cat.lower(): cat for cat in merged.keys()}
    
    for line in rules_text.splitlines():
        line = line.strip()
        if not line:
            continue
            
        # Support both ':' and '=' as delimiters
        delimiter = None
        if ":" in line:
            delimiter = ":"
        elif "=" in line:
            delimiter = "="
            
        if not delimiter:
            continue
            
        parts = line.split(delimiter, 1)
        cat_name_raw = parts[0].strip().lower()
        if cat_name_raw not in category_map:
            continue
            
        cat_key = category_map[cat_name_raw]
        rules_part = parts[1].strip()
        if not rules_part:
            continue
            
        terms = [t.strip() for t in rules_part.split(",")]
        for term in terms:
            if not term:
                continue
            if term.lower().startswith("regex:"):
                pattern = term[6:].strip()
                if pattern:
                    try:
                        re.compile(pattern)
                        if pattern not in merged[cat_key]["regex"]:
                            merged[cat_key]["regex"].append(pattern)
                    except re.error as e:
                        print(f"Skipping invalid user regex: {pattern}. Error: {e}")
            else:
                kw = term.lower()
                if kw not in merged[cat_key]["keywords"]:
                    merged[cat_key]["keywords"].append(kw)
                    
    return merged


# Alias classify_statements to classify_batch for backward compatibility/pipeline conventions
classify_statements = classify_batch

