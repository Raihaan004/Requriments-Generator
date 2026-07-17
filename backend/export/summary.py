def get_flat_rows(rows: list[dict]) -> list[dict]:
    """
    Normalizes/flattens a list of classified rows.
    Supports both nested 'classification' and flat statement-category pairing formats.
    """
    flat_rows = []
    if not rows:
        return flat_rows
        
    for r in rows:
        if "classification" in r:
            # Nested format: {"text": "...", "source_doc": "...", "line_number": ..., "classification": {category: {matched, score}}}
            classification = r.get("classification") or {}
            for category, details in classification.items():
                flat_rows.append({
                    "category": category,
                    "text": r.get("text", ""),
                    "source_doc": r.get("source_doc", ""),
                    "line_number": r.get("line_number", 0),
                    "matched_rules": details.get("matched", []),
                    "score": details.get("score", 0)
                })
        else:
            # Flat format: {"category": "...", "text": "...", "source_doc": "...", "line_number": ..., "matched_rules": [...], "score": ...}
            flat_rows.append({
                "category": r.get("category", ""),
                "text": r.get("text", r.get("statement", "")),
                "source_doc": r.get("source_doc", ""),
                "line_number": r.get("line_number", 0),
                "matched_rules": r.get("matched_rules", []),
                "score": r.get("score", 0)
            })
    return flat_rows


def build_summary_sheet(rows: list[dict]) -> dict:
    """
    Returns counts per category and per source_doc:
    {
        "total_statements": int,
        "by_category": {"Functionality": int, "Mechanism": int, "Performance": int, "Fault Management": int},
        "by_source": {"requirements": int, "platform": int, "regulatory": int}
    }
    """
    flat_rows = get_flat_rows(rows)
    
    # Identify unique statements that matched at least one category
    unique_statements = {}
    for r in flat_rows:
        if not r["category"]:
            continue
        key = (r["text"], r["source_doc"], r["line_number"])
        unique_statements[key] = r["source_doc"]
        
    total_statements = len(unique_statements)
    
    by_category = {
        "Functionality": 0,
        "Mechanism": 0,
        "Performance": 0,
        "Fault Management": 0
    }
    for r in flat_rows:
        cat = r["category"]
        if cat in by_category:
            by_category[cat] += 1
            
    by_source = {
        "requirements": 0,
        "platform": 0,
        "regulatory": 0
    }
    for source in unique_statements.values():
        if source in by_source:
            by_source[source] += 1
            
    return {
        "total_statements": total_statements,
        "by_category": by_category,
        "by_source": by_source
    }
