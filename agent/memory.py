import os
from typing import List
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from termcolor import cprint

class CodeMemory:
    def __init__(self, base_db_path: str, embedding_model: str):
        self.base_db_path = base_db_path
        self.embeddings = HuggingFaceEndpointEmbeddings(repo_id=embedding_model)

    def _get_db(self, session_id: str):
        """Get a Chroma instance specific to this user session."""
        # We segregate users by COLLECTION NAME, not just metadata.
        # This is faster and cleaner for isolation.
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
        relative_path = file_path # Assuming file_path passed is already relative or we clean it
        
        # 1. DELETE OLD CHUNKS
        # We query by the metadata 'source' which stores the filename
        try:
            # Note: Chroma syntax for delete requires a 'where' clause
            db.delete(where={"session_id": session_id, "source": relative_path})
            cprint(f"   [Memory] Cleared old entry for {relative_path}", "grey")
        except Exception as e:
            # It's okay if it fails (e.g., file didn't exist yet)
            pass

        splitter = RecursiveCharacterTextSplitter.from_language(
            language=Language.JS, chunk_size=1000, chunk_overlap=100
        )
        
        chunks = splitter.create_documents(
            [code_content], 
            metadatas=[{"source": relative_path, "session_id": session_id}]
        )

        # 3. ADD NEW CHUNKS
        if chunks:
            db.add_documents(chunks)
            cprint(f"   [Memory] Indexed {relative_path}", "grey")

    # def index_files(self, session_id: str, code_dir: str):
    #     """Reads files from the user's dir and embeds them."""
    #     db = self._get_db(session_id)
        
    #     # 1. SCAN DIRECTORY
    #     docs = []
    #     splitter = RecursiveCharacterTextSplitter.from_language(
    #         language=Language.JS, chunk_size=1000, chunk_overlap=100
    #     )
        
    #     cprint(f" [Memory] Indexing code for Session: {session_id}...", "cyan")

    #     for root, _, files in os.walk(code_dir):
    #         for file in files:
    #             # Filter for relevant code files
    #             if file.endswith(('.js', '.jsx', '.py', '.html', '.css', '.json')):
    #                 full_path = os.path.join(root, file)
    #                 relative_path = os.path.relpath(full_path, code_dir)
                    
    #                 try:
    #                     with open(full_path, 'r', encoding='utf-8') as f:
    #                         content = f.read()
                        
    #                     # Chunk the code
    #                     chunks = splitter.create_documents(
    #                         [content], 
    #                         metadatas=[{"source": relative_path, "session_id": session_id}]
    #                     )
    #                     docs.extend(chunks)
    #                 except Exception as e:
    #                     cprint(f"   Skipped {file}: {e}", "red")

    #     # 2. UPDATE DB
    #     if docs:
    #         db.add_documents(docs)
    #         cprint(f" [Memory] Embedded {len(docs)} chunks.", "green")
    #     else:
    #         cprint(" [Memory] No files found to index.", "yellow")

    def query_codebase(self, session_id: str, query: str, k: int = 5) -> str:
        """Semantic search for the Debugger."""
        db = self._get_db(session_id)
        results = db.similarity_search(query, k=k)
        
        context = []
        for doc in results:
            context.append(f"## FILE: {doc.metadata['source']}\n{doc.page_content}")
        
        return "\n\n".join(context)

    def generate_repo_map(self, code_dir: str) -> str:
        """Generates a text-based tree structure for the Architect."""
        tree_str = ""
        for root, dirs, files in os.walk(code_dir):
            level = root.replace(code_dir, '').count(os.sep)
            indent = ' ' * 4 * (level)
            tree_str += f"{indent}{os.path.basename(root)}/\n"
            subindent = ' ' * 4 * (level + 1)
            for f in files:
                tree_str += f"{subindent}{f}\n"
        return tree_str