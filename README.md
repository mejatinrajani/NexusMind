# NexusMind: Agentic GraphRAG Platform

A sophisticated, multi-tenant GraphRAG (Graph Retrieval Augmented Generation) platform that combines vector-based semantic search with knowledge graph reasoning for advanced question-answering capabilities.

## Overview

NexusMind is an intelligent document ingestion and retrieval system that leverages:

- **Vector Store (Chroma)**: Fast semantic similarity search across documents
- **Knowledge Graph (Neo4j)**: Entity and relationship extraction for structured reasoning
- **Agentic Orchestration (LangGraph)**: Multi-step reasoning workflows with intelligent routing
- **LLM Integration (Groq)**: Powerful language models (Llama 3.3 70B, Llama 3.1 8B) for generation
- **FastAPI Backend**: High-performance REST API with async support
- **React Frontend**: Modern, responsive user interface

## ✨ Key Features

- **Multi-Tenant Architecture**: Isolated chatbot instances with dedicated knowledge bases
- **Hybrid Retrieval**: Combines vector search, graph traversal, and web search
- **Intelligent Routing**: Automatic query classification for optimal retrieval strategy
- **Document Ingestion**: Support for PDFs, images, and text documents
- **Background Processing**: Asynchronous document processing without blocking requests
- **Real-time Reasoning**: Live demonstration of reasoning paths and knowledge retrieval
- **Cloud-Scale OCR**: AWS Textract integration for advanced document parsing

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Neo4j Desktop (running locally)
- Groq API Key ([Get it here](https://console.groq.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mejatinrajani/NexusMind.git
   cd NexusMind
   ```

2. **Backend Setup**
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Create .env file with your API keys
   cp .env.example .env
   # Edit .env and add your GROQ_API_KEY
   
   # Initialize databases
   python initialize_db.py
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Run the Application**
   
   **Backend** (from project root):
   ```bash
   python -m uvicorn app.api.server:app --reload
   ```
   Backend runs on: `http://localhost:8000`
   API Docs: `http://localhost:8000/docs`

   **Frontend** (from frontend directory):
   ```bash
   npm run dev
   ```
   Frontend runs on: `http://localhost:5173`

## 📁 Project Structure

```
NexusMind/
├── app/
│   ├── api/
│   │   └── server.py              # FastAPI application & endpoints
│   ├── core/
│   │   ├── agents.py              # Agent orchestration logic
│   │   ├── graph.py               # LangGraph workflow engine
│   │   └── tools.py               # Tool definitions (search, retrieval)
│   ├── database/
│   │   ├── chroma_client.py       # Vector store client
│   │   ├── neo4j_client.py        # Graph database client
│   │   ├── sql_client.py          # SQLite metadata storage
│   │   └── chroma/                # Vector store persistence
│   ├── ingestion/
│   │   ├── parser.py              # Document parser (Textract integration)
│   │   └── extractor.py           # Entity/relationship extraction
│   ├── config.py                  # Application configuration
│   └── logger.py                  # Logging setup
├── frontend/                       # React application
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── App.jsx                # Main application component
│   │   └── main.jsx               # Entry point
│   ├── package.json               # Node.js dependencies
│   └── vite.config.js             # Vite configuration
├── requirements.txt               # Python dependencies
├── initialize_db.py               # Database initialization script
└── test_api.py                    # API testing utilities
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
GROQ_API_KEY=your_groq_api_key_here

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Model Configuration
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
REASONING_LLM=llama-3.3-70b-versatile
ROUTING_LLM=llama-3.1-8b-instant
```

## API Endpoints

### Chat Endpoints

- **POST `/chat`** - Submit a question to a chatbot
  ```json
  {
    "chatbot_id": "bot_001",
    "question": "What are the main topics in this document?"
  }
  ```

- **POST `/create-bot`** - Create a new chatbot instance
  ```json
  {
    "chatbot_id": "bot_001",
    "name": "Document Assistant",
    "system_prompt": "You are a helpful document assistant."
  }
  ```

- **POST `/upload`** - Upload documents to a chatbot
  - Form data: `file` (document), `chatbot_id` (string)
  - Supports: PDF, PNG, JPG, JPEG

### Interactive API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive Swagger documentation.

## Architecture

### Data Flow

1. **Document Ingestion**
   - User uploads document via frontend
   - Backend routes to AWS Textract for extraction
   - Text split into semantic chunks (700 tokens, 50 token overlap)

2. **Knowledge Base Construction**
   - Chunks embedded using sentence-transformers
   - Embeddings stored in Chroma (vector search)
   - Entities/relationships extracted to Neo4j (knowledge graph)
   - Metadata stored in SQLite

3. **Query Processing**
   - User submits question via chat interface
   - Router agent classifies query type
   - Conditional routing to: vector search, graph traversal, or web search
   - Groq LLM generates answer from retrieved context
   - Reasoning path displayed to user

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend Framework** | FastAPI | RESTful API server |
| **Vector Store** | Chroma | Semantic similarity search |
| **Graph Database** | Neo4j | Entity/relationship storage |
| **Metadata DB** | SQLite | Chatbot config & document tracking |
| **AI Orchestration** | LangGraph | Multi-step reasoning workflows |
| **LLM Provider** | Groq API | Cloud inference for reasoning |
| **Embeddings** | Sentence-Transformers | Local embedding generation |
| **Frontend** | React 19 + Vite | Interactive user interface |
| **Styling** | Tailwind CSS | Responsive design |
| **Document Parsing** | AWS Textract + PyPDF | Advanced OCR & PDF extraction |

## Security

- CORS enabled for frontend-backend communication
- Environment variables for sensitive credentials
- Input validation using Pydantic models
- SQLite database for isolated data per chatbot

## Performance Considerations

- **Async Processing**: Background workers prevent blocking on large document uploads
- **Batch Operations**: Bulk vector insertion for efficiency
- **Connection Pooling**: Neo4j connection pool for database scaling
- **Local Inference**: Sentence-transformers for embeddings without API calls

## Testing

Run the test API utilities:

```bash
python test_api.py
```

Verify database connections:

```bash
python initialize_db.py
```

## Roadmap

- [ ] Multi-language support
- [ ] Fine-tuned domain-specific models
- [ ] Advanced graph visualization
- [ ] Chat history persistence
- [ ] User authentication & authorization
- [ ] Deployment guides (Docker, Azure)

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Author

**Jatin Rajani**

- GitHub: [@mejatinrajani](https://github.com/mejatinrajani)
- Project: [NexusMind](https://github.com/mejatinrajani/NexusMind)

## Acknowledgments

- [LangChain](https://langchain.com) - Framework for LLM applications
- [Groq](https://groq.com) - Fast LLM inference
- [Chroma](https://www.trychroma.com) - Vector database
- [Neo4j](https://neo4j.com) - Graph database
- [FastAPI](https://fastapi.tiangolo.com) - Modern web framework
- [React](https://react.dev) - UI library

## Support

For issues, feature requests, or questions:
- Open an issue on [GitHub](https://github.com/mejatinrajani/NexusMind/issues)
- Contact: mejatinrajani.tech@gmail.com

---

**Built with ❤️ by Jatin Rajani**
