# NexusMind: Technical Architecture & Development Guide

**Author:** Jatin Rajani  
**Version:** 1.0.0  
**Last Updated:** 2025

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Database Layer](#database-layer)
5. [API Reference](#api-reference)
6. [Data Ingestion Pipeline](#data-ingestion-pipeline)
7. [Query Processing Workflow](#query-processing-workflow)
8. [Deployment Architecture](#deployment-architecture)
9. [Development Guide](#development-guide)
10. [Performance & Optimization](#performance--optimization)
11. [Security Architecture](#security-architecture)
12. [Troubleshooting](#troubleshooting)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NexusMind Platform                            │
└─────────────────────────────────────────────────────────────────┘
           │                                          │
           ▼                                          ▼
    ┌─────────────┐                          ┌─────────────┐
    │ React SPA   │                          │  FastAPI    │
    │ Frontend    │◄────────────────────────►│  Backend    │
    │ (Vite)      │     REST API + CORS      │ (Uvicorn)   │
    └─────────────┘                          └─────────────┘
           │                                          │
           │                      ┌──────────────────┼──────────────────┐
           │                      ▼                  ▼                  ▼
           │              ┌──────────────┐  ┌──────────────┐  ┌────────────────┐
           │              │ LangGraph    │  │   Groq API   │  │   AWS Textract │
           │              │ Orchestration│  │   (LLM)      │  │   (OCR)        │
           │              └──────────────┘  └──────────────┘  └────────────────┘
           │                      │
           │        ┌─────────────┼─────────────┐
           │        ▼             ▼             ▼
           │   ┌─────────┐  ┌──────────┐  ┌──────────────┐
           │   │ Chroma  │  │  Neo4j   │  │   SQLite     │
           │   │ (Vector)│  │ (Graph)  │  │  (Metadata)  │
           │   └─────────┘  └──────────┘  └──────────────┘
           │
           └───────────────────────────────────────────────────────
                    (Optional Direct Vector Search)
```

### Component Interaction Flow

```
User Input
    │
    ├─► Frontend (React)
    │      └─► Validates user query
    │      └─► Sends to FastAPI
    │
    ▼
FastAPI (REST Endpoint)
    │
    ├─► Request validation (Pydantic)
    ├─► Queue background task (if upload)
    ├─► Or route to LangGraph (if chat)
    │
    ▼
LangGraph Workflow Engine
    │
    ├─► Router Node: Classify query type
    │      ├─► Vector Search
    │      ├─► Graph Search
    │      └─► Web Search
    │
    ├─► Retrieval Node(s): Fetch context
    │      ├─► Chroma: Vector similarity
    │      ├─► Neo4j: Graph traversal
    │      └─► DuckDuckGo: Web search
    │
    └─► Generation Node: LLM reasoning
           ├─► Groq API call
           ├─► Format response
           └─► Return to frontend
```

---

## Backend Architecture

### Directory Structure

```
app/
├── api/
│   └── server.py              # FastAPI application (ASGI)
│       ├── app = FastAPI()
│       ├── CORS middleware
│       ├── POST /chat         # Query endpoint
│       ├── POST /create-bot   # Bot creation
│       ├── POST /upload       # Document upload
│       └── Background tasks
│
├── core/
│   ├── agents.py              # Agent orchestration
│   │   └── AgentManager
│   │       ├── Router agent
│   │       ├── Retrieval agents
│   │       └── Generation agent
│   │
│   ├── graph.py               # LangGraph workflow
│   │   ├── GraphState (TypedDict)
│   │   ├── GraphEngine
│   │   │   ├── node_route_query()
│   │   │   ├── node_retrieve_vector()
│   │   │   ├── node_retrieve_graph()
│   │   │   ├── node_retrieve_web()
│   │   │   └── node_generate_answer()
│   │   └── decide_next_hop() - conditional routing
│   │
│   └── tools.py               # Tool definitions
│       ├── vector_search_tool()  → Chroma
│       ├── graph_search_tool()   → Neo4j
│       └── web_search_tool()     → DuckDuckGo
│
├── database/
│   ├── sql_client.py          # SQLite interface
│   │   ├── init_db()
│   │   ├── create_or_update_bot()
│   │   ├── get_bot()
│   │   └── Store: chatbot metadata
│   │
│   ├── chroma_client.py       # Chroma vector store
│   │   ├── ChromaManager
│   │   ├── add_documents()    - bulk insert
│   │   ├── search()           - similarity search
│   │   └── Collections per chatbot_id
│   │
│   └── neo4j_client.py        # Neo4j graph database
│       ├── Neo4jManager
│       ├── create_entity()
│       ├── create_relationship()
│       ├── traverse_graph()
│       └── Isolated graphs per chatbot_id
│
├── ingestion/
│   ├── parser.py              # Document parsing
│   │   ├── UniversalParser
│   │   ├── process_file()     → AWS Textract
│   │   ├── _parse_pdf_via_textract()
│   │   ├── _parse_image_via_textract()
│   │   └── _chunk_pages()     → Split into chunks
│   │
│   └── extractor.py           # Entity extraction
│       ├── GraphExtractor
│       ├── extract_entities()
│       ├── extract_relationships()
│       └── write_chunk_to_graph()
│
├── config.py                  # Pydantic settings
│   ├── BASE_DIR
│   ├── DATA_DIR
│   ├── API keys & credentials
│   └── Model names & endpoints
│
└── logger.py                  # Logging configuration
    └── setup_logger()
```

### Core Classes & Their Responsibilities

#### 1. FastAPI Application (server.py)

```python
class FastAPI:
    """ASGI server"""
    - Handles HTTP requests/responses
    - CORS middleware for frontend access
    - Route definitions
    - Error handling
    - OpenAPI/Swagger documentation
```

**Key Routes:**

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| POST | `/chat` | Query a chatbot | `{ answer, reasoning_path }` |
| POST | `/create-bot` | Create new bot | `{ chatbot_id, status }` |
| POST | `/upload` | Upload document | `{ status, filename }` |
| GET | `/docs` | Swagger UI | Interactive API docs |

#### 2. GraphEngine (graph.py)

Orchestrates the LangGraph workflow state machine:

```python
class GraphState(TypedDict):
    question: str              # User input
    chatbot_id: str           # Bot identifier
    system_prompt: str        # Bot personality
    datasource: str           # Retrieved documents
    documents: str            # Full context
    steps: List[str]          # Reasoning trace
    generation: str           # LLM output

class GraphEngine:
    def _compile_workflow(self):
        """Builds state machine"""
        builder = StateGraph(GraphState)
        
        # Nodes (computation units)
        builder.add_node("router_node", self.node_route_query)
        builder.add_node("vector_retriever", self.node_retrieve_vector)
        builder.add_node("graph_retriever", self.node_retrieve_graph)
        builder.add_node("web_retriever", self.node_retrieve_web)
        builder.add_node("generator_node", self.node_generate_answer)
        
        # Entry point
        builder.set_entry_point("router_node")
        
        # Conditional edges (routing logic)
        builder.add_conditional_edges(
            "router_node",
            self.decide_next_hop,  # Decision function
            {
                "vector": "vector_retriever",
                "graph": "graph_retriever",
                "web": "web_retriever"
            }
        )
        
        # Final generation
        builder.add_edge("vector_retriever", "generator_node")
        builder.add_edge("graph_retriever", "generator_node")
        builder.add_edge("web_retriever", "generator_node")
        builder.add_edge("generator_node", END)
        
        return builder.compile()
```

#### 3. ChromaManager (chroma_client.py)

Vector store management:

```python
class ChromaManager:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=str(settings.CHROMA_PERSIST_DIR)
        )
    
    def add_documents(self, chatbot_id, texts, metadatas, ids):
        """Bulk insert vectors into Chroma collection"""
        collection = self.client.get_or_create_collection(
            name=f"bot_{chatbot_id}"
        )
        collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
    
    def search(self, chatbot_id, query, n_results=5):
        """Semantic similarity search"""
        collection = self.client.get_collection(f"bot_{chatbot_id}")
        return collection.query(query_texts=[query], n_results=n_results)
```

#### 4. Neo4jManager (neo4j_client.py)

Graph database management:

```python
class Neo4jManager:
    def __init__(self):
        self.driver = graphdatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    
    def create_entity(self, chatbot_id, entity_type, properties):
        """Create node in graph"""
        with self.driver.session() as session:
            session.run(
                f"MATCH (kb:KnowledgeBase {{id: '{chatbot_id}'}}) "
                f"CREATE (e:{entity_type} $props)-[:BELONGS_TO]->(kb)",
                props=properties
            )
    
    def traverse_graph(self, chatbot_id, start_entity, depth=2):
        """Graph traversal query"""
        # Returns connected entities and relationships
```

#### 5. UniversalParser (parser.py)

Document text extraction using AWS Textract:

```python
class UniversalParser:
    def process_file(self, file_path):
        """
        1. Detect file type (.pdf, .png, .jpg)
        2. Route to AWS Textract
        3. Extract text/OCR
        4. Split into chunks
        5. Return list of chunk dicts with metadata
        """
        filename = os.path.basename(file_path)
        _, ext = os.path.splitext(filename)
        
        if ext == ".pdf":
            raw_pages = self._parse_pdf_via_textract(file_path)
        elif ext in [".png", ".jpg", ".jpeg"]:
            raw_pages = self._parse_image_via_textract(file_path)
        
        return self._chunk_pages(raw_pages, filename)
    
    def _chunk_pages(self, raw_pages, filename):
        """
        Splits pages into semantic chunks (700 tokens, 50 overlap)
        Returns: [
            {
                "text": "chunk content",
                "metadata": {"source": filename, "page": 1},
                "id": "unique_id"
            },
            ...
        ]
        """
```

### Request/Response Models (Pydantic)

```python
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
```

### Configuration Management (config.py)

```python
class Settings(BaseSettings):
    """Pydantic Settings with environment variable validation"""
    
    # Paths
    BASE_DIR: Path                    # Project root
    DATA_DIR: Path                    # Database storage
    CHROMA_PERSIST_DIR: Path          # Vector store dir
    
    # API Keys
    GROQ_API_KEY: str                # Required for LLM
    
    # Models
    EMBEDDING_MODEL_NAME: str         # Local embeddings
    REASONING_LLM: str               # Groq model (70B)
    ROUTING_LLM: str                 # Groq model (8B)
    
    # Database
    NEO4J_URI: str                   # bolt://localhost:7687
    NEO4J_USER: str                  # neo4j
    NEO4J_PASSWORD: str              # password
    
    def __init__(self):
        super().__init__()
        os.makedirs(self.DATA_DIR, exist_ok=True)
        os.makedirs(self.CHROMA_PERSIST_DIR, exist_ok=True)

settings = Settings()  # Global singleton
```

---

## Frontend Architecture

### React Application Structure

```
frontend/
├── index.html                 # HTML entry point
├── src/
│   ├── main.jsx              # React mount point
│   ├── App.jsx               # Root component
│   ├── App.css               # Global styles
│   ├── index.css             # Base styles
│   │
│   ├── components/
│   │   ├── BotCreator.jsx    # Create new chatbot
│   │   │   └── State: botId, name, systemPrompt
│   │   │   └── POST /create-bot
│   │   │
│   │   ├── ChatWindow.jsx    # Message display area
│   │   │   └── Props: messages[], chatbotId
│   │   │   └── Displays Q&A with reasoning
│   │   │
│   │   ├── ChatInput.jsx     # Query input & submit
│   │   │   └── Props: onSend()
│   │   │   └── POST /chat
│   │   │
│   │   └── Sidebar.jsx       # Navigation & bot list
│   │       └── Lists available bots
│   │       └── File upload area
│   │
│   └── assets/               # Images, icons, etc.
│
├── package.json              # Dependencies
├── vite.config.js            # Vite build config
├── postcss.config.js         # PostCSS configuration
├── tailwind.config.js        # Tailwind CSS config
└── eslint.config.js          # ESLint rules
```

### Component Hierarchy

```
<App>
├── <BotCreator />         (Create new chatbot)
├── <Sidebar />            (Bot selection & upload)
└── <ChatWindow />         (Display messages)
    └── <ChatInput />      (Input & submit)
```

### Frontend State Management

**App.jsx** maintains application state:

```javascript
const [bots, setBots] = useState([]);           // List of chatbots
const [activeBotId, setActiveBotId] = useState(null);  // Current bot
const [messages, setMessages] = useState([]);   // Chat history
const [loading, setLoading] = useState(false);  // Loading indicator
```

### API Integration

```javascript
// Create bot
const createBot = async (botId, name, systemPrompt) => {
    const response = await fetch('http://localhost:8000/create-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbot_id: botId, name, system_prompt: systemPrompt })
    });
    return response.json();
};

// Send chat message
const sendMessage = async (botId, question) => {
    const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbot_id: botId, question })
    });
    return response.json();
};

// Upload document
const uploadDocument = async (botId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatbot_id', botId);
    const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
    });
    return response.json();
};
```

### Build & Development

**Vite Configuration** (vite.config.js):
- React plugin integration
- Fast HMR (Hot Module Replacement)
- Optimized production builds

**Tailwind CSS Integration**:
- Utility-first CSS framework
- Responsive design system
- Dark mode support (optional)

---

## Database Layer

### Three-Tier Database Architecture

```
┌──────────────────────────────────────────────────────┐
│          Application Logic (FastAPI)                 │
└──────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    ┌─────────┐ ┌──────────┐ ┌──────────────┐
    │ SQLite  │ │ Chroma   │ │   Neo4j      │
    │---------|│(Vector)  │ │   (Graph)    │
    │Metadata │ │---------|│ │---------|    │
    │         │ │Vectors   │ │Entities &   │
    │- Bots   │ │Embeddings│ │Relations   │
    │- Docs   │ │Per bot   │ │Per bot      │
    │- Config │ │          │ │            │
    └─────────┘ └──────────┘ └──────────────┘
```

### 1. SQLite (Metadata Store)

**Purpose**: Catalog and configuration storage

**Schema**:

```sql
CREATE TABLE chatbots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    system_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    chatbot_id TEXT NOT NULL,
    filename TEXT,
    file_type TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chatbot_id) REFERENCES chatbots(id)
);

CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chatbot_id TEXT NOT NULL,
    content TEXT,
    embedding_id TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (chatbot_id) REFERENCES chatbots(id)
);
```

**Access Pattern**:
- Read: `get_bot(chatbot_id)` - Bot configuration
- Write: `create_or_update_bot(chatbot_id, name, system_prompt)` - Bot creation
- Query: List documents per bot

### 2. Chroma (Vector Store)

**Purpose**: Fast semantic search via embeddings

**Structure**:

```
Chroma Collections (per chatbot):
├── bot_001 (Collection)
│   ├── ID: "chunk_001"
│   │   Document: "The capital of France is Paris..."
│   │   Metadata: {"source": "geography.pdf", "page": 5}
│   │   Embedding: [0.234, 0.456, ...] (384 dims)
│   │
│   ├── ID: "chunk_002"
│   │   Document: "Paris is known for the Eiffel Tower..."
│   │   Metadata: {"source": "geography.pdf", "page": 6}
│   │   Embedding: [0.289, 0.501, ...] (384 dims)
│   │
│   └── ID: "chunk_003"
│       ...
│
└── bot_002 (Collection)
    ├── ID: "chunk_001"
    │   ...
```

**Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2`
- Output dimension: 384
- Processing: Local (no API calls)
- Speed: ~1000 embeddings/second on CPU

**Query Example**:
```python
# Search for similar documents
results = chroma_mgr.search(
    chatbot_id="bot_001",
    query="What is the Eiffel Tower?",
    n_results=5
)
# Returns: [
#   {"id": "chunk_002", "document": "...", "distance": 0.15},
#   {"id": "chunk_001", "document": "...", "distance": 0.23},
#   ...
# ]
```

### 3. Neo4j (Knowledge Graph)

**Purpose**: Structured entity relationships for reasoning

**Graph Schema**:

```
Graph Structure per Chatbot:

(KnowledgeBase {id: "bot_001"})
    │
    ├─[CONTAINS_ENTITY]─→ (Person {name: "Alice", role: "Engineer"})
    │                         │
    │                         ├─[WORKS_AT]→ (Company {name: "Tech Corp"})
    │                         └─[MANAGES]→ (Project {name: "ProjectX"})
    │
    ├─[CONTAINS_ENTITY]─→ (Company {name: "Tech Corp"})
    │                         │
    │                         ├─[LOCATED_IN]→ (Location {name: "San Francisco"})
    │                         └─[DEVELOPS]→ (Technology {name: "AI/ML"})
    │
    └─[CONTAINS_ENTITY]─→ (Document {filename: "report.pdf", pages: 50})
                              └─[MENTIONS]→ (Person {name: "Alice"})
```

**Query Examples**:

```cypher
// Find all people in a knowledge base
MATCH (kb:KnowledgeBase {id: "bot_001"})-[:CONTAINS_ENTITY]->(p:Person)
RETURN p.name, p.role

// Find relationships between entities
MATCH (p:Person)-[r]->(c:Company)
WHERE p.name = "Alice"
RETURN type(r), c.name

// Multi-hop traversal
MATCH (p:Person)-[:WORKS_AT]->(c:Company)-[:LOCATED_IN]->(l:Location)
WHERE p.name = "Alice"
RETURN c.name, l.name
```

---

## API Reference

### REST Endpoints

#### 1. Create Chatbot

**Request**:
```
POST /create-bot
Content-Type: application/json

{
    "chatbot_id": "bot_001",
    "name": "My AI Assistant",
    "system_prompt": "You are a helpful assistant that answers questions based on documents."
}
```

**Response** (200 OK):
```json
{
    "status": "success",
    "chatbot_id": "bot_001",
    "message": "Chatbot created successfully"
}
```

**Database Operations**:
- SQLite: Insert into `chatbots` table
- Neo4j: Create `(KnowledgeBase {id: "bot_001"})`

---

#### 2. Upload Document

**Request**:
```
POST /upload
Content-Type: multipart/form-data

file: [binary PDF/image data]
chatbot_id: "bot_001"
```

**Response** (200 OK):
```json
{
    "status": "processing",
    "filename": "document.pdf",
    "chatbot_id": "bot_001",
    "message": "Document queued for background processing"
}
```

**Background Processing**:
1. Save temp file
2. Parse with AWS Textract
3. Split into chunks (700 tokens, 50 overlap)
4. Embed each chunk (sentence-transformers)
5. Insert into Chroma
6. Extract entities → Neo4j
7. Clean up temp file

---

#### 3. Chat/Query

**Request**:
```
POST /chat
Content-Type: application/json

{
    "chatbot_id": "bot_001",
    "question": "What is the main topic of the document?"
}
```

**Response** (200 OK):
```json
{
    "answer": "The main topic of the document is...",
    "reasoning_path": [
        "Router classified query as 'vector_search'",
        "Retrieved 5 similar chunks from vector store",
        "Graph search found 3 related entities",
        "Generated answer using Groq Llama 3.3"
    ]
}
```

**Processing Flow**:
1. Validate request (Pydantic)
2. Call `GraphEngine.invoke(state)`
3. Router classifies query type
4. Retrieve context from Chroma/Neo4j
5. Call Groq API with context + system prompt
6. Return formatted response

---

## Data Ingestion Pipeline

### End-to-End Document Processing

```
Document Upload
    ├─ File Validation
    │  └─ Check extension (.pdf, .png, .jpg)
    │
    ├─ AWS Textract Processing
    │  ├─ Extract text/OCR
    │  ├─ Preserve layout (tables, headers)
    │  └─ Return structured blocks
    │
    ├─ Text Chunking
    │  ├─ Split with overlap (700/50)
    │  └─ Preserve semantic boundaries
    │
    ├─ Vector Embedding
    │  ├─ sentence-transformers local model
    │  ├─ Generate 384-dim embeddings
    │  └─ Store in Chroma
    │
    ├─ Entity Extraction
    │  ├─ NLP processing
    │  ├─ Identify entities & relationships
    │  └─ Write to Neo4j graph
    │
    └─ Metadata Persistence
       ├─ Document record (SQLite)
       ├─ Chunk mappings
       └─ Upload timestamp
```

### Chunking Strategy

```python
RecursiveCharacterTextSplitter(
    chunk_size=700,          # Tokens per chunk
    chunk_overlap=50,        # Overlap between chunks
    separators=["\n\n", "\n", ".", " ", ""]  # Split priority
)
```

**Why 700 tokens?**
- Fits in context window with other context
- Preserves semantic meaning
- Balances retrieval precision

**Why 50 token overlap?**
- Ensures continuity between chunks
- Captures cross-boundary relationships
- Minimal redundancy

### Entity Extraction Flow

```python
def write_chunk_to_graph(self, chatbot_id, chunk_data):
    """
    1. Use LLM to identify entities in chunk
    2. Classify entity types (Person, Location, Company, etc.)
    3. Extract relationships between entities
    4. Write to Neo4j:
       - Create nodes for each entity
       - Create edges for relationships
       - Link to KnowledgeBase
    """
    text = chunk_data["text"]
    
    # Call LLM for extraction
    entities = self.extract_entities(text)      # → List[Entity]
    relationships = self.extract_relationships(text)  # → List[Rel]
    
    # Write to Neo4j
    for entity in entities:
        neo4j_mgr.create_entity(chatbot_id, entity.type, entity.properties)
    
    for rel in relationships:
        neo4j_mgr.create_relationship(
            chatbot_id,
            rel.from_entity,
            rel.type,
            rel.to_entity
        )
```

---

## Query Processing Workflow

### Multi-Hop Retrieval & Reasoning

```
User Query: "What technologies does Alice work with?"

Step 1: Router Node
├─ Classify query intent
├─ Options: "vector_search", "graph_search", "web_search", "combined"
└─ Decision: → "graph_search" (entity-based question)

Step 2: Graph Retrieval Node
├─ Parse entities from query: ["Alice", "technologies"]
├─ Neo4j traverse:
│  ├─ (Person {name: "Alice"})
│  ├─[WORKS_AT]→ (Company)
│  ├─[USES_TECHNOLOGY]→ (Technology)
│  └─ Collect all matched entities
├─ Build context string
└─ Format for LLM

Step 3: LLM Generation Node
├─ Construct prompt:
│   - System prompt: (bot personality)
│   - Retrieved context: (entities + relationships)
│   - User query: "What technologies does Alice work with?"
├─ Call Groq API (Llama 3.3 70B)
├─ Get response from LLM
└─ Format & return to user

Output: {
    "answer": "Alice works with Python, TensorFlow, PyTorch...",
    "reasoning_path": [
        "1. Classified as 'graph_search' (entity question)",
        "2. Queried graph for Person 'Alice'",
        "3. Traversed WORKS_AT relationships",
        "4. Found technologies via USES_TECHNOLOGY edges",
        "5. Generated summary with Groq Llama 3.3"
    ]
}
```

### Router Decision Logic

```python
def decide_next_hop(self, state: GraphState) -> str:
    """
    Classify query and route to appropriate retriever
    
    Logic:
    - If entities mentioned → graph_search
    - If topic/concept question → vector_search
    - If current news/events → web_search
    - Otherwise → vector_search (default)
    """
    question = state["question"]
    
    # Use routing LLM (faster 8B model)
    routing_llm = ChatGroq(model_name=settings.ROUTING_LLM)
    
    response = routing_llm.invoke(f"""
    Classify this question for retrieval type:
    {question}
    
    Response with ONLY ONE: "vector", "graph", "web"
    """)
    
    classification = response.content.strip().lower()
    
    if "graph" in classification:
        return "graph"
    elif "web" in classification:
        return "web"
    else:
        return "vector"
```

---

## Deployment Architecture

### Local Development

```
Your Machine
├── Backend (localhost:8000)
│   ├── FastAPI server (uvicorn)
│   ├── LangGraph workflows
│   └── API clients
│
├── Frontend (localhost:5173)
│   ├── React dev server (Vite HMR)
│   └── Static assets
│
└── External Services
    ├── Groq API (cloud inference)
    ├── AWS Textract (OCR)
    ├── Neo4j Desktop (local graph DB)
    └── SQLite (local metadata)
```

### Production Deployment (Suggested)

```
Azure Cloud Architecture:

┌─────────────────────────────────────────┐
│          Azure Container Registry       │
│  ├─ Backend:NexusMind-api:<tag>        │
│  └─ Frontend:NexusMind-ui:<tag>        │
└─────────────────────────────────────────┘
           │
           ├─────────────┬────────────────┐
           ▼             ▼                ▼
    ┌────────────┐  ┌──────────┐  ┌──────────────┐
    │Azure       │  │ Azure    │  │  Azure       │
    │App Service │  │Database  │  │  Cosmos DB   │
    │(FastAPI)   │  │(Neo4j)   │  │  (Vectors)   │
    └────────────┘  └──────────┘  └──────────────┘
           │
           └──→ Azure App Service (Frontend React)
                │
                └──→ Azure CDN (Static assets)

External:
├─ Groq API (model inference)
├─ AWS Textract (document OCR)
└─ Azure Key Vault (credentials)
```

---

## Development Guide

### Setting Up Development Environment

1. **Clone Repository**
   ```bash
   git clone https://github.com/mejatinrajani/NexusMind.git
   cd NexusMind
   ```

2. **Backend Setup**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Configuration**
   ```bash
   # Create .env file
   cp .env.example .env
   
   # Edit .env and add:
   GROQ_API_KEY=your_api_key_here
   ```

5. **Initialize Databases**
   ```bash
   # Start Neo4j Desktop manually
   python initialize_db.py
   ```

6. **Run Development Servers**
   
   **Terminal 1 (Backend)**:
   ```bash
   python -m uvicorn app.api.server:app --reload --port 8000
   ```
   
   **Terminal 2 (Frontend)**:
   ```bash
   cd frontend
   npm run dev
   ```

### Development Workflow

1. **Make Code Changes**
   - Backend: Changes auto-reload (uvicorn --reload)
   - Frontend: Changes auto-reload (Vite HMR)

2. **Test Locally**
   - API: `http://localhost:8000/docs` (Swagger UI)
   - Frontend: `http://localhost:5173`

3. **Debug**
   ```python
   # Add logging for debugging
   from app.logger import setup_logger
   logger = setup_logger(__name__)
   logger.debug("Debug message")
   logger.error("Error message", exc_info=True)
   ```

4. **Run Tests**
   ```bash
   python test_api.py
   python initialize_db.py  # Verify DB connections
   ```

### Common Development Tasks

#### Add New API Endpoint

```python
# In app/api/server.py

@app.post("/new-endpoint")
async def new_endpoint(request: NewRequestModel) -> NewResponseModel:
    """New endpoint description"""
    try:
        # Implementation
        return NewResponseModel(...)
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

#### Add New Graph Node

```python
# In app/core/graph.py

def node_new_operation(state: GraphState) -> GraphState:
    """Perform new operation"""
    # Process state
    state["key"] = "value"
    return state

# In _compile_workflow():
builder.add_node("new_node", self.node_new_operation)
builder.add_edge("previous_node", "new_node")
```

#### Add New Tool

```python
# In app/core/tools.py

def new_tool(query: str) -> str:
    """Tool description"""
    # Implementation
    return result

# Register in agents.py
agent_tools = [
    ...,
    new_tool
]
```

---

## Performance & Optimization

### Bottleneck Analysis

| Component | Bottleneck | Optimization |
|-----------|-----------|--------------|
| **Document Upload** | File parsing (AWS Textract) | Async background task |
| **Vector Embedding** | Embedding generation | Batch processing, GPU acceleration |
| **Graph Queries** | Neo4j traversal | Index creation, query optimization |
| **LLM Calls** | Groq API latency | Caching, prompt optimization |
| **Frontend** | Bundle size | Code splitting, tree-shaking |

### Performance Metrics

```
Upload Document (PDF, 50 pages):
├─ Textract parsing: 5-10 seconds
├─ Chunking & embedding: 2-3 seconds
├─ Neo4j writes: 1-2 seconds
└─ Total: 8-15 seconds (asynchronous)

Chat Query:
├─ Router classification: 200ms (8B model)
├─ Vector search: 50ms (5 results)
├─ LLM generation: 2-4 seconds (70B model)
└─ Total: 2.2-4.25 seconds

Vector Embedding (1000 chunks):
├─ Local model: ~1 second
└─ Cost: $0 (no API calls)
```

### Optimization Strategies

1. **Batch Operations**
   ```python
   # ✅ Good - Batch insert
   chroma_mgr.add_documents(chatbot_id, texts, metadatas, ids)
   
   # ❌ Bad - Loop insert
   for text in texts:
       chroma_mgr.add_document(chatbot_id, text)
   ```

2. **Caching**
   ```python
   # Cache frequently accessed data
   from functools import lru_cache
   
   @lru_cache(maxsize=128)
   def get_bot(chatbot_id: str):
       return db.query(Bot).filter(Bot.id == chatbot_id).first()
   ```

3. **Database Indexes**
   ```sql
   -- SQLite
   CREATE INDEX idx_chatbot_id ON documents(chatbot_id);
   
   -- Neo4j
   CREATE INDEX idx_entity_type ON Entity(type);
   ```

4. **Async Operations**
   ```python
   # Use async for I/O-bound operations
   @app.post("/upload")
   async def upload(file: UploadFile, chatbot_id: str, background_tasks: BackgroundTasks):
       # Save file
       # Queue background task
       background_tasks.add_task(process_uploaded_document, file_path, chatbot_id)
       # Return immediately
       return {"status": "processing"}
   ```

---

## Security Architecture

### Input Validation

```python
# Pydantic models automatically validate input
class ChatRequest(BaseModel):
    chatbot_id: str = Field(..., min_length=1, max_length=100)
    question: str = Field(..., min_length=1, max_length=5000)

# FastAPI rejects invalid requests automatically
```

### API Security

```python
# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # ⚠️ Open for dev; restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Production: Restrict to frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

### Environment Variable Management

```python
# Never expose API keys in code
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str  # Loaded from .env only
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# .env file (in .gitignore)
GROQ_API_KEY=sk_xxxxxxxxxxxx
```

### Database Security

```python
# Neo4j authentication
driver = graphdatabase.driver(
    uri,
    auth=(username, password)  # Change default credentials
)

# SQLite (no built-in auth)
# File permissions: chmod 600 database.db
```

### Recommended Production Security

- [ ] Enable HTTPS/TLS
- [ ] Implement JWT authentication
- [ ] Add rate limiting
- [ ] Use API keys for external services
- [ ] Implement CORS whitelist
- [ ] Enable SQL/NoSQL injection prevention
- [ ] Use secrets manager (Azure Key Vault)
- [ ] Enable audit logging

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: GROQ_API_KEY not found

**Error**: `ValidationError: GROQ_API_KEY field required`

**Solution**:
```bash
# Create .env file
GROQ_API_KEY=your_actual_key_here

# Verify it's loaded
python -c "from app.config import settings; print(settings.GROQ_API_KEY)"
```

#### Issue: Neo4j connection refused

**Error**: `ServiceUnavailable: Unable to establish connection to localhost:7687`

**Solution**:
1. Open Neo4j Desktop
2. Start the default database
3. Verify credentials: neo4j / password
4. Check `NEO4J_URI=bolt://localhost:7687`

#### Issue: Chroma database locked

**Error**: `database is locked`

**Solution**:
```bash
# Multiple processes accessing same database
# Solution: Use single persistent ChromaManager instance
# Or restart all Python processes
pkill -f uvicorn  # Kill all uvicorn servers
```

#### Issue: "aws: command not found" (for Textract)

**Error**: AWS Textract requires boto3 credentials

**Solution**:
```bash
# Install AWS CLI
pip install awscli

# Configure credentials
aws configure
# Enter: AWS Access Key ID, Secret Access Key, Region, Output format

# Or set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

#### Issue: Frontend not connecting to backend

**Error**: CORS error in browser console

**Solution**:
1. Check backend is running: `http://localhost:8000/docs`
2. Check frontend is on `http://localhost:5173`
3. CORS headers are being sent correctly
4. Use exact URLs (not 127.0.0.1 vs localhost)

#### Issue: Slow vector search

**Problem**: Querying Chroma is slow for large collections

**Solution**:
```python
# Use smaller collection size
# Implement pagination
# Add database indexing (Chroma auto-indexes)

# Check Chroma version
pip install --upgrade chromadb

# Monitor performance
import time
start = time.time()
results = collection.query(query_texts=["test"], n_results=5)
print(f"Search took {time.time() - start:.2f}s")
```

#### Issue: LLM response is slow

**Problem**: Groq API calls take >5 seconds

**Solution**:
```python
# Use faster routing model (8B instead of 70B for routing)
# Implement caching for similar queries
# Batch API calls if possible
# Consider using smaller models for generation

# Check Groq status
curl https://status.groq.com/
```

### Debug Mode

Enable detailed logging:

```python
# In app/logger.py or config
import logging
logging.basicConfig(level=logging.DEBUG)

# Or set environment variable
export LOG_LEVEL=DEBUG
```

### Performance Debugging

```python
import time

# Profile function execution
def profile_execution(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        duration = time.time() - start
        logger.info(f"{func.__name__} took {duration:.2f}s")
        return result
    return wrapper

@profile_execution
def slow_function():
    ...
```

---

## Conclusion

NexusMind combines state-of-the-art technologies (LangGraph, Groq, Neo4j, Chroma) to create a powerful GraphRAG platform. This documentation provides a comprehensive overview of the architecture, implementation details, and operational guidance.

For questions or contributions, refer to the [README.md](README.md) for contact information.

---

**Document Version**: 1.0.0  
**Last Updated**: 2025  
**Author**: Jatin Rajani
