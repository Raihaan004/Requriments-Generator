import os
from docx import Document
from docx.document import Document as DocumentType
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph

def iter_block_items(parent):
    """
    Yield each paragraph and table child within parent, in document order.
    Each returned value is an instance of Paragraph or Table.
    """
    if isinstance(parent, DocumentType):
        parent_elm = parent.element.body
    else:
        raise TypeError("Unsupported parent type for iteration")

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)

def parse_docx(filepath: str) -> str:
    """
    Parses a DOCX document, preserving reading order between paragraphs and tables.
    Tables are formatted with row cells separated by ' | '.
    
    If the file is unreadable or corrupted, raises ValueError.
    """
    if not os.path.exists(filepath):
        raise ValueError(f"Could not parse DOCX: File does not exist at {filepath}")

    try:
        doc = Document(filepath)
        doc_parts = []

        for block in iter_block_items(doc):
            if isinstance(block, Paragraph):
                text = block.text.strip()
                if text:
                    doc_parts.append(text)
            elif isinstance(block, Table):
                table_rows = []
                for row in block.rows:
                    cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                    # Only include row if it has content
                    if any(cells):
                        table_rows.append(" | ".join(cells))
                if table_rows:
                    doc_parts.append("\n".join(table_rows))
                    
        return "\n\n".join(doc_parts).strip()
        
    except Exception as e:
        raise ValueError(f"Could not parse DOCX: file may be corrupted or invalid. Details: {str(e)}")
