import os
import io
import fitz     
import boto3
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.logger import setup_logger

logger = setup_logger("ingestion.parser")

class UniversalParser:
    """
    Tier 3 Enterprise Parser using AWS Textract.
    Offloads OCR and layout parsing to the cloud for maximum speed and accuracy.
    """
    
    def __init__(self, chunk_size: int = 700, chunk_overlap: int = 50):
        # Initialize AWS Textract Client
        self.textract_client = boto3.client('textract')
        
        # Fallback to standard chunking since Textract returns raw block lines
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""]
        )

    def process_file(self, file_path: str) -> List[Dict[str, Any]]:
        filename = os.path.basename(file_path)
        _, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        logger.info(f"Routing {filename} to AWS Textract for cloud extraction...")
        raw_pages = []

        try:
            if ext == ".pdf":
                raw_pages = self._parse_pdf_via_textract(file_path)
            elif ext in [".png", ".jpg", ".jpeg"]:
                raw_pages = self._parse_image_via_textract(file_path)
            else:
                logger.warning(f"Unsupported file extension for Textract: {ext}")
                return []
                
            return self._chunk_pages(raw_pages, filename)
            
        except Exception as e:
            logger.error(f"AWS Textract Extraction failed for {filename}: {str(e)}")
            return []

    def _parse_pdf_via_textract(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Slices the PDF into memory buffers and hits the sync Textract API.
        This bypasses the need to upload documents to an S3 bucket first.
        """
        pages = []
        doc = fitz.open(file_path)
        
        for i in range(len(doc)):
            page = doc[i]
            logger.info(f"Uploading page {i+1}/{len(doc)} to AWS Textract...")
            
            # Render page to a high-quality image buffer (150-200 DPI recommended for OCR)
            pix = page.get_pixmap(dpi=150)
            image_bytes = pix.tobytes("jpeg")
            
            # Call AWS Textract
            response = self.textract_client.detect_document_text(
                Document={'Bytes': image_bytes}
            )
            
            # Reconstruct the page text while preserving reading order
            page_text = ""
            for item in response.get('Blocks', []):
                if item['BlockType'] == 'LINE':
                    page_text += item['Text'] + "\n"
                    
            if page_text.strip():
                pages.append({"text": page_text.strip(), "page": i + 1})
                
        doc.close()
        return pages

    def _parse_image_via_textract(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'rb') as document:
            image_bytes = bytearray(document.read())
            
        response = self.textract_client.detect_document_text(
            Document={'Bytes': image_bytes}
        )
        
        page_text = ""
        for item in response.get('Blocks', []):
            if item['BlockType'] == 'LINE':
                page_text += item['Text'] + "\n"
                
        if page_text.strip():
            return [{"text": page_text.strip(), "page": 1}]
        return []

    def _chunk_pages(self, pages: List[Dict[str, Any]], filename: str) -> List[Dict[str, Any]]:
        chunks = []
        for page_data in pages:
            text_splits = self.text_splitter.split_text(page_data["text"])
            for i, chunk_text in enumerate(text_splits):
                chunk_id = f"{filename}_p{page_data['page']}_c{i}"
                chunks.append({
                    "id": chunk_id,
                    "text": chunk_text,
                    "metadata": {
                        "source": filename,
                        "page": page_data["page"],
                        "chunk_index": i,
                        "chunk_id": chunk_id
                    }
                })
                
        logger.info(f"Successfully chunked {len(chunks)} vectors from {filename}")
        return chunks