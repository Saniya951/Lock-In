import os
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, UnstructuredMarkdownLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

# --- Configuration ---
DOCS_PATH = "../scraped_documentation" 
DB_PATH = "chroma_db" # <-- This will be the directory for ChromaDB
HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def create_vector_db():
    """Creates a persistent Chroma vector database from markdown documentation."""
    # Check for Hugging Face API token
    if not os.getenv("HUGGINGFACEHUB_API_TOKEN"):
        raise ValueError("Hugging Face API token not found. Please set HUGGINGFACEHUB_API_TOKEN in your .env file.")

    print("Loading documentation...")
    loader = DirectoryLoader(DOCS_PATH, glob="**/*.md", loader_cls=UnstructuredMarkdownLoader)
    documents = loader.load()

    if not documents:
        print("No documents found. Please check your DOCS_PATH.")
        return

    print(f"Loaded {len(documents)} documents.")

    print("Splitting documents into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(documents)
    print(f"Split into {len(docs)} chunks.")

    print("Creating embeddings via Hugging Face Inference API...")
    embeddings = HuggingFaceEndpointEmbeddings(
        repo_id=HF_EMBEDDING_MODEL
    )

    print("Creating and persisting ChromaDB index...")
    db = Chroma.from_documents(
        docs,
        embeddings,
        persist_directory=DB_PATH 
    )
    print(f"Vector database created and saved to '{DB_PATH}'")

if __name__ == "__main__":
    create_vector_db()