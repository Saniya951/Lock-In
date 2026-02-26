import os
from typing import List
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from termcolor import cprint

# every instance, is instantiated with base db path, embedding object and a chroma instance specific to that user
# only update_file func in use right now
class CodeMemory:
    def __init__(self, base_db_path: str, embedding_model: str):
        self.base_db_path = base_db_path
        self.embeddings = HuggingFaceEndpointEmbeddings(repo_id=embedding_model)

    def _get_db(self, session_id: str):
        """Get a Chroma instance specific to this user session."""
        # takes the base db path and embedding func and adds a collection name
        return Chroma(
            persist_directory=self.base_db_path,
            embedding_function=self.embeddings,
            collection_name=f"session_{session_id}"
        )

    def update_file(self, session_id: str, file_path: str, code_content: str):
        """
        Updates the vector DB for a SINGLE file.
        1. Deletes old chunks for this specific file.
        2. Embeds the new content.
        """
        db = self._get_db(session_id)
        relative_path = file_path

        #delete old chunks (v1) of that file (scenario: if coder rewrites the file then to avoid overlap we delete first version)
        try:
            db.delete(where={"session_id": session_id, "source": relative_path})
        except Exception as e:
            pass

        # dynamic splitter  (used for language specific chunking)
        ext = os.path.splitext(relative_path)[1].lower()
        if ext in ['.js', '.jsx', '.ts', '.tsx']:
            lang = Language.JS
        elif ext in ['.py']:
            lang = Language.PYTHON
        elif ext in ['.html']:
            lang = Language.HTML
        else:
            # Default fallback for css, txt, etc.
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            lang = None

        if lang:
            splitter = RecursiveCharacterTextSplitter.from_language(
                language=lang, chunk_size=1000, chunk_overlap=100
            )
        
        chunks = splitter.create_documents(
            [code_content], 
            metadatas=[{"source": relative_path, "session_id": session_id}]   #adds a metadata to every chunk(imp!!!)
        )
        if chunks:
            db.add_documents(chunks)
            cprint(f"   [Memory] Updated {relative_path}", "grey")
            

    def query_codebase(self, session_id: str, query: str, k: int = 5) -> str:
        # function that performs similarity search for debugger. right now, not in use
        """Semantic search for the Debugger."""
        db = self._get_db(session_id)
        results = db.similarity_search(query, k=k)
        
        context = []
        for doc in results:
            context.append(f"## FILE: {doc.metadata['source']}\n{doc.page_content}")
        
        return "\n\n".join(context)

    def generate_repo_map(self, code_dir: str) -> str:
        """Generates a text-based tree structure for the Architect."""
        # repo map of entire codebase. again not in use
        tree_str = ""
        for root, dirs, files in os.walk(code_dir):
            level = root.replace(code_dir, '').count(os.sep)
            indent = ' ' * 4 * (level)
            tree_str += f"{indent}{os.path.basename(root)}/\n"
            subindent = ' ' * 4 * (level + 1)
            for f in files:
                tree_str += f"{subindent}{f}\n"
        return tree_str