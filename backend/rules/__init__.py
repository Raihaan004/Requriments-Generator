import os
import json

REQUIRED_CATEGORIES = {"Functionality", "Mechanism", "Performance", "Fault Management"}

def load_rules(custom_path: str = None) -> dict:
    """
    Loads and validates the categories definition dictionary.
    
    :param custom_path: Optional custom file path to load instead of the default categories.json.
    :return: A dictionary containing the rule taxonomy.
    :raises FileNotFoundError: If the rules file cannot be found.
    :raises ValueError: If the JSON is invalid, or if any of the four required categories is missing.
    """
    if custom_path is None:
        # Default path is in the same directory as this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(current_dir, "categories.json")
    else:
        path = custom_path

    if not os.path.exists(path):
        raise FileNotFoundError(f"Rules file not found at: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Malformed JSON in rules file: {e}") from e

    if not isinstance(data, dict):
        raise ValueError("Rules file top-level structure must be a JSON object (dictionary).")

    # Validate categories
    missing_categories = REQUIRED_CATEGORIES - set(data.keys())
    if missing_categories:
        raise ValueError(
            f"Rules file is missing required categories: {', '.join(sorted(missing_categories))}"
        )

    # Validate structure of each category to ensure they have the expected keys
    for category, content in data.items():
        if not isinstance(content, dict):
            raise ValueError(f"Category '{category}' must be a dictionary/object.")
        
        required_keys = {"description", "keywords", "regex", "weight"}
        missing_keys = required_keys - set(content.keys())
        if missing_keys:
            raise ValueError(
                f"Category '{category}' content is missing required keys: {', '.join(sorted(missing_keys))}"
            )
        
        if not isinstance(content["keywords"], list):
            raise ValueError(f"Category '{category}' 'keywords' must be a list.")
        
        if not isinstance(content["regex"], list):
            raise ValueError(f"Category '{category}' 'regex' must be a list.")

    return data
