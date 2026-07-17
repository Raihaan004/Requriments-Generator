import pdfplumber
import os

def parse_pdf(filepath: str) -> str:
    """
    Parses a PDF document, extracting both regular text and table content.
    Tables are preserved with row cells separated by ' | '.
    
    If the file is unreadable, corrupted, or password-protected, raises ValueError.
    """
    if not os.path.exists(filepath):
        raise ValueError(f"Could not parse PDF: File does not exist at {filepath}")
        
    try:
        pages_content = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text_raw = page.extract_text()
                page_text = page_text_raw.strip() if page_text_raw else ""
                
                # Extract tables
                try:
                    tables = page.extract_tables() or []
                except Exception:
                    # If table extraction fails on a specific page, fallback to empty
                    tables = []
                
                formatted_tables = []
                for table in tables:
                    if not table:
                        continue
                    formatted_rows = []
                    for row in table:
                        # Convert cells to string, clean whitespace, handle None values
                        cells = [str(cell).strip() if cell is not None else "" for cell in row]
                        # Only include row if it has some non-empty content
                        if any(cells):
                            formatted_rows.append(" | ".join(cells))
                    if formatted_rows:
                        formatted_tables.append("\n".join(formatted_rows))
                
                # Combine page text and formatted tables
                page_parts = []
                if page_text:
                    page_parts.append(page_text)
                if formatted_tables:
                    page_parts.extend(formatted_tables)
                
                pages_content.append("\n\n".join(page_parts))
                
        # Join all pages
        return "\n\n".join([p for p in pages_content if p]).strip()
        
    except Exception as e:
        # Wrap any library exception in a clear ValueError
        raise ValueError(f"Could not parse PDF: file may be corrupted or password-protected. Details: {str(e)}")
