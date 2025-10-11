"""
setup_vectordb_groq.py
Uses FREE HuggingFace embeddings (runs locally, lightweight)
For generation, we'll use Groq API (fast & free)
Run: python setup_vectordb_groq.py
"""

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

def detect_content_type(content):
    """Detect the type of content for better organization"""
    content_lower = content.lower()
    
    if any(hook in content for hook in ['useState', 'useEffect', 'useContext', 'useRef']):
        return 'hooks'
    elif 'function' in content and 'return' in content:
        return 'component'
    elif '```' in content:
        return 'code-example'
    elif 'example' in content_lower or 'usage' in content_lower:
        return 'example'
    
    return 'documentation'

def setup_vector_store():
    """
    Set up vector store using FREE local embeddings
    """
    print(" Loading React documentation...")
    
    docs_path = Path('react-docs')
    
    if not docs_path.exists():
        print(f" Error: {docs_path} directory not found!")
        print("Please run 'python scrape_docs.py' first.")
        return
    
    loader = DirectoryLoader(
        str(docs_path),
        glob="*.md",
        loader_cls=TextLoader,
        loader_kwargs={'encoding': 'utf-8'}
    )
    
    documents = loader.load()
    print(f" Loaded {len(documents)} documents")
    
    # Split documents into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=['\n## ', '\n### ', '\n#### ', '\n\n', '\n', ' ', ''],
        length_function=len,
    )
    
    print("  Splitting documents into chunks...")
    split_docs = text_splitter.split_documents(documents)
    print(f" Created {len(split_docs)} chunks")
    
    # Add metadata to chunks
    for i, doc in enumerate(split_docs):
        filename = Path(doc.metadata['source']).stem
        doc.metadata.update({
            'chunk_id': i,
            'source_file': filename,
            'content_type': detect_content_type(doc.page_content)
        })
    
    # Create embeddings using HuggingFace (FREE & LOCAL)
    print(" Creating embeddings using HuggingFace (free & local)...")
    print(" First run will download model (~80MB)...")
    print("(This takes 2-3 minutes on first run)\n")
    
    try:
        # Use a small, fast embedding model that runs on CPU
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        # Create vector store
        print(" Creating vector database...")
        vector_store = Chroma.from_documents(
            documents=split_docs,
            embedding=embeddings,
            collection_name="react-docs",
            persist_directory="./chroma_db"
        )
        
        print("\n Vector store created successfully!")
        print(f" Total chunks stored: {len(split_docs)}")
        print(f" Database saved to: ./chroma_db")
        
        # Test the vector store
        print("\n Testing vector store...")
        test_query = "How do I use useState?"
        results = vector_store.similarity_search(test_query, k=3)
        
        print(f"Query: '{test_query}'")
        print(f"✓ Found {len(results)} relevant chunks")
        
        print("\n Setup complete! Now you can use Groq for generation.")
        print(" Make sure you have GROQ_API_KEY in your .env file")
        
        return vector_store
        
    except Exception as e:
        print(f"\n Error: {e}")
        print("\n Install required package:")
        print("   pip install sentence-transformers")
        return None

if __name__ == '__main__':
    setup_vector_store()