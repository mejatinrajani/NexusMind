import os
import shutil
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.database.sql_client import init_db, create_or_update_bot
from app.config import settings
from app.logger import setup_logger
import logging
from app.ingestion.parser import UniversalParser
from app.ingestion.extractor import GraphExtractor
from app.database.chroma_client import ChromaManager
from app.core.graph import GraphEngine
from dotenv import load_dotenv
logger = setup_logger("api.server")

# --- Initialize the ASGI Application ---
app = FastAPI(
    title="NexusMind Agentic GraphRAG API",
    description="Multi-tenant backend for hybrid vector-graph reasoning.",
    version="1.0.0"
)
# Create SQLite tables on server startup
init_db()
# Allow Cross-Origin requests for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
load_dotenv()
# In-memory tracker for background extraction tasks
active_sync_tasks = set()
# --- Pydantic Data Models for the API ---

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Ignore any access log that contains "/status" in the request line
        return "/status" not in record.getMessage()

# Attach the filter to Uvicorn's access logger
logging.getLogger("uvicorn.access").addFilter(EndpointFilter())


class ChatRequest(BaseModel):
    chatbot_id: str
    question: str

class ChatResponse(BaseModel):
    answer: str
    reasoning_path: List[str]

class BotCreateRequest(BaseModel):
    chatbot_id: str
    name: str
    system_prompt: str

# --- Background Worker Implementation ---
def process_uploaded_document(file_path: str, chatbot_id: str, original_filename: str):
    """
    Background worker that extracts text, embeds vectors, and builds the knowledge graph.
    Runs asynchronously without blocking the user's web request.
    """
    logger.info(f"Starting background ingestion for file: {original_filename} into chatbot: {chatbot_id}")
    
    try:
        # 1. Parse Document into Chunks
        parser = UniversalParser()
        chunks = parser.process_file(file_path)
        
        if not chunks:
            logger.warning(f"No text extracted from {original_filename}. Ingestion aborted.")
            return

        # 2. Access our thread-safe database connections
        chroma_mgr = ChromaManager()
        graph_extractor = GraphExtractor()
        
        texts = []
        metadatas = []
        ids = []
        
        # 3. Process each chunk
        for chunk in chunks:
            # Store data arrays for bulk vector insertion
            texts.append(chunk["text"])
            metadatas.append(chunk["metadata"])
            ids.append(chunk["id"])
            
            # Extract Entities/Relationships and write to Neo4j instantly
            graph_extractor.write_chunk_to_graph(chatbot_id=chatbot_id, chunk_data=chunk)
            
        # 4. Commit embeddings to Vector Store in bulk
        chroma_mgr.add_documents(
            chatbot_id=chatbot_id,
            texts=texts,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"Ingestion complete for {original_filename}. {len(chunks)} chunks processed.")
        
    except Exception as e:
        logger.error(f"Background ingestion failed for {original_filename}: {str(e)}", exc_info=True)
    finally:
        # Clean up the temporary file from the hard drive
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up temporary file: {file_path}")

def process_batch_documents(file_paths: List[str], chatbot_id: str, original_filenames: List[str]):
    """Background worker that processes files and tracks sync status."""
    logger.info(f"Starting batch ingestion of {len(file_paths)} files into chatbot: {chatbot_id}")
    
    # Mark this bot as currently syncing
    active_sync_tasks.add(chatbot_id)
    
    try:
        for file_path, original_filename in zip(file_paths, original_filenames):
            process_uploaded_document(
                file_path=file_path, 
                chatbot_id=chatbot_id, 
                original_filename=original_filename
            )
        logger.info(f"Batch ingestion completely finished for chatbot: {chatbot_id}")
    finally:
        # Guarantee the bot is marked as 'idle' when finished or if it crashes
        active_sync_tasks.discard(chatbot_id)

@app.post("/api/v1/ingest/batch")
async def upload_multiple_documents(
    background_tasks: BackgroundTasks,
    chatbot_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Uploads multiple documents simultaneously and queues them for batch extraction.
    """
    logger.info(f"Received batch upload of {len(files)} files for chatbot '{chatbot_id}'.")
    
    # Ensure temporary directory exists
    temp_dir = settings.DATA_DIR / "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    
    saved_file_paths = []
    original_filenames = []
    
    try:
        # 1. Safely save all files to disk first
        for file in files:
            temp_file_path = temp_dir / f"{chatbot_id}_{file.filename}"
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            saved_file_paths.append(str(temp_file_path))
            original_filenames.append(file.filename)
            
        # 2. Queue the background processing
        background_tasks.add_task(
            process_batch_documents,
            file_paths=saved_file_paths,
            chatbot_id=chatbot_id,
            original_filenames=original_filenames
        )
        
        return {
            "status": "processing",
            "message": f"{len(files)} files accepted and queued for knowledge extraction.",
            "files_queued": len(files),
            "chatbot_id": chatbot_id
        }
    except Exception as e:
        logger.error(f"Failed to process batch file upload: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process batch upload.")

@app.post("/api/v1/ingest")
async def upload_document(
    background_tasks: BackgroundTasks,
    chatbot_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Uploads a document and queues it for asynchronous knowledge extraction.
    """
    logger.info(f"Received upload request for file '{file.filename}' targeting chatbot '{chatbot_id}'.")
    
    # Save the file to a temporary disk location safely
    temp_dir = settings.DATA_DIR / "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = temp_dir / f"{chatbot_id}_{file.filename}"
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Queue the background processing to run after the API responds
        background_tasks.add_task(
            process_uploaded_document,
            file_path=str(temp_file_path),
            chatbot_id=chatbot_id,
            original_filename=file.filename
        )
        
        return {
            "status": "processing",
            "message": f"File '{file.filename}' accepted and queued for knowledge extraction.",
            "chatbot_id": chatbot_id
        }
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process file upload.")

@app.post("/api/v1/bots")
async def configure_bot(request: BotCreateRequest):
    """
    Creates a new custom bot workspace or updates an existing one's instructions.
    """
    logger.info(f"Configuring bot profile for: {request.chatbot_id}")
    try:
        create_or_update_bot(
            bot_id=request.chatbot_id, 
            name=request.name, 
            system_prompt=request.system_prompt
        )
        return {"status": "success", "message": f"Bot '{request.name}' configured successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save bot configuration.")
    
@app.get("/api/v1/bots/{chatbot_id}/status")
async def get_bot_sync_status(chatbot_id: str):
    """Returns 'processing' if the background thread is running, otherwise 'idle'."""
    if chatbot_id in active_sync_tasks:
        return {"status": "processing"}
    return {"status": "idle"}   
    
@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Executes the multi-agent LangGraph pipeline to answer a user's question.
    """
    logger.info(f"Chat request received for chatbot '{request.chatbot_id}': {request.question}")
    
    engine = GraphEngine()
    
    # Initialize the memory state dictionary for LangGraph
    initial_state = {
        "question": request.question,
        "chatbot_id": request.chatbot_id,
        "datasource": "",
        "documents": "",
        "steps": ["received_query"],
        "generation": ""
    }
    
    try:
        # Execute the stateful graph loop
        final_state = engine.workflow.invoke(initial_state)
        
        return ChatResponse(
            answer=final_state.get("generation", "Error generating answer."),
            reasoning_path=final_state.get("steps", [])
        )
    except Exception as e:
        logger.error(f"Chat execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Agent execution failed.")