import os

def parse_txt(filepath: str) -> str:
    """
    Parses a plain text file, reading it as UTF-8 with a fallback to latin-1
    if UTF-8 decoding fails.
    
    If the file cannot be read, raises ValueError.
    """
    if not os.path.exists(filepath):
        raise ValueError(f"Could not parse TXT: File does not exist at {filepath}")
        
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    except (UnicodeDecodeError, UnicodeError):
        try:
            with open(filepath, "r", encoding="latin-1") as f:
                return f.read().strip()
        except Exception as e:
            raise ValueError(f"Could not parse TXT: File decoding failed. Details: {str(e)}")
    except Exception as e:
        raise ValueError(f"Could not parse TXT: File read failed. Details: {str(e)}")
