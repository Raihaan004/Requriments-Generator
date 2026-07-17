from .pdf_parser import parse_pdf
from .docx_parser import parse_docx
from .txt_parser import parse_txt
from .url_parser import parse_url

def parse_document(filepath: str, file_type: str) -> str:
    """
    Dispatches document parsing to the correct parser function based on the file_type.
    
    Supported file_types:
    - 'pdf': Parses PDF file using pdfplumber, extracting text and tables.
    - 'docx': Parses Word file using python-docx, preserving paragraph/table order.
    - 'txt': Parses plain text using UTF-8/Latin-1 fallback.
    - 'url': Parses a web page URL using requests/BeautifulSoup.
    
    Returns clean plain text string or raises ValueError if parsing fails.
    """
    if not file_type:
        raise ValueError("Cannot parse document: File type is unspecified or empty")
        
    normalized_type = file_type.strip().lower()
    
    if normalized_type == "pdf":
        return parse_pdf(filepath)
    elif normalized_type == "docx":
        return parse_docx(filepath)
    elif normalized_type == "txt":
        return parse_txt(filepath)
    elif normalized_type == "url":
        return parse_url(filepath) # filepath is the URL string in this case
    else:
        raise ValueError(f"Unsupported file type: '{file_type}'. Supported types: 'pdf', 'docx', 'txt', 'url'")
