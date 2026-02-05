import os
import json
import shutil # Import for deleting the old directory
from dotenv import load_dotenv
from langchain_community.document_loaders import UnstructuredMarkdownLoader
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

    print("Finding and loading documentation from index.json files...")
    
    all_documents = [] # This will hold our Document objects
    
    # Walk the directory to find all index.json files
    for root, dirs, files in os.walk(DOCS_PATH):
        if "index.json" in files:
            index_path = os.path.join(root, "index.json")
            print(f"  Processing index: {index_path}")
            
            try:
                with open(index_path, 'r', encoding='utf-8') as f:
                    index_data = json.load(f)
            except Exception as e:
                print(f"    Error reading {index_path}: {e}. Skipping.")
                continue
            
            # Process each entry in this index.json
            for item in index_data:
                filename = item.get("filename")
                url = item.get("url")
                title = item.get("title", "No title") # Get title, fallback
                
                if not filename or not url:
                    print(f"    Skipping item, missing filename or url: {item}")
                    continue
                    
                md_path = os.path.join(root, filename)
                
                if not os.path.exists(md_path):
                    print(f"    Skipping, file not found: {md_path}")
                    continue
                    
                try:
                    # Load the single markdown file
                    loader = UnstructuredMarkdownLoader(md_path)
                    loaded_docs = loader.load() # This returns a list of Document
                    
                    # Add the correct metadata to each loaded doc
                    for doc in loaded_docs:
                        doc.metadata["source"] = url
                        doc.metadata["title"] = title
                        all_documents.append(doc)
                        
                except Exception as e:
                    print(f"    Error loading {md_path}: {e}")

    if not all_documents:
        print("No documents found. Please check your DOCS_PATH and index.json files.")
        return

    print(f"Loaded {len(all_documents)} documents from all indexes.")

    print("Splitting documents into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(all_documents) # Use all_documents here
    print(f"Split into {len(docs)} chunks.")

    print("Creating embeddings via Hugging Face Endpoint Embeddings...")
    embeddings = HuggingFaceEndpointEmbeddings(
        repo_id=HF_EMBEDDING_MODEL
    )

    # --- NEW: Remove old database before creating new one ---
    if os.path.exists(DB_PATH):
        print(f"Removing old database at '{DB_PATH}'...")
        shutil.rmtree(DB_PATH)
        print("Old database removed.")

    print("Creating and persisting ChromaDB index...")
    db = Chroma.from_documents(
        docs,
        embeddings,
        persist_directory=DB_PATH 
    )
    print(f"Vector database created and saved to '{DB_PATH}'")

if __name__ == "__main__":
    create_vector_db()