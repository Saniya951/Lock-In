"""
agent_retrieval.py
React documentation retrieval agent - searches and displays relevant code snippets
Run: python agent_retrieval.py
"""

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from pathlib import Path
import time

class ReactRetrievalAgent:
    """
    Simple retrieval agent - searches documentation and returns relevant snippets
    No LLM needed, completely FREE and fast!
    """
    
    def __init__(self):
        self.vector_store = None
        self.initialized = False
    
    def initialize(self):
        """Initialize the vector store"""
        if self.initialized:
            return True
        
        print(" Initializing React Documentation Retrieval Agent...")
        
        # Check if vector store exists
        if not Path('./chroma_db').exists():
            print(" Error: Vector store not found!")
            print("Please run 'python setup_vectordb_groq.py' first.")
            return False
        
        try:
            # Initialize embeddings (local, free)
            print(" Loading embeddings model...")
            embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2",
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
            
            # Load existing ChromaDB collection
            print(" Loading vector database...")
            self.vector_store = Chroma(
                collection_name="react-docs",
                embedding_function=embeddings,
                persist_directory="./chroma_db"
            )
            
            self.initialized = True
            print(" Agent initialized!\n")
            return True
            
        except Exception as e:
            print(f" Error initializing: {e}")
            return False
    
    def search(self, query, num_results=5, show_full=False):
        """
        Search for relevant documentation snippets
        
        Args:
            query (str): User's search query
            num_results (int): Number of results to return
            show_full (bool): Show full content or just preview
            
        Returns:
            list: List of relevant documentation snippets
        """
        if not self.initialized:
            if not self.initialize():
                return []
        
        start_time = time.time()
        
        print(f"\n Searching for: '{query}'")
        
        # Retrieve relevant documentation
        results = self.vector_store.similarity_search_with_score(
            query,
            k=num_results
        )
        
        search_time = time.time() - start_time
        print(f"✓ Found {len(results)} relevant snippets ({search_time:.2f}s)\n")
        
        formatted_results = []
        
        for i, (doc, score) in enumerate(results, 1):
            source_file = doc.metadata.get('source_file', 'unknown')
            content_type = doc.metadata.get('content_type', 'documentation')
            
            # Calculate relevance percentage (lower score = more relevant)
            relevance = max(0, min(100, (1 - score) * 100))
            
            result_data = {
                'rank': i,
                'source': source_file,
                'type': content_type,
                'relevance': relevance,
                'score': score,
                'content': doc.page_content if show_full else doc.page_content[:500]
            }
            
            formatted_results.append(result_data)
        
        return formatted_results
    
    def display_results(self, results):
        """
        Display search results in a formatted way
        
        Args:
            results (list): List of search results
        """
        if not results:
            print("No results found.")
            return
        
        print("="*70)
        print("SEARCH RESULTS")
        print("="*70)
        
        for result in results:
            print(f"\n[{result['rank']}]  {result['source']}")
            print(f"    Type: {result['type']} | Relevance: {result['relevance']:.1f}%")
            print(f"    {'-'*66}")
            
            # Display content with proper formatting
            content = result['content'].strip()
            
            # Highlight code blocks
            if '```' in content:
                print("     Contains code example")
            
            # Show content
            lines = content.split('\n')
            for line in lines[:20]:  # Show first 20 lines
                print(f"    {line}")
            
            if len(lines) > 20:
                print(f"    ... ({len(lines) - 20} more lines)")
            
            print(f"    {'-'*66}")
        
        # Summary
        print("\n" + "="*70)
        sources = list(set(r['source'] for r in results))
        print(f" Sources: {', '.join(sources)}")
        print("="*70)
    
    def get_code_examples(self, query, num_results=5):
        """
        Search specifically for code examples
        
        Args:
            query (str): Search query
            num_results (int): Number of results
            
        Returns:
            list: Code examples found
        """
        if not self.initialized:
            if not self.initialize():
                return []
        
        print(f"\n Searching for code examples: '{query}'")
        
        # Search with filter for code examples
        results = self.vector_store.similarity_search(
            query,
            k=num_results * 2  # Get more results to filter
        )
        
        # Filter for code-containing snippets
        code_results = []
        for doc in results:
            if '```' in doc.page_content or 'function' in doc.page_content:
                code_results.append({
                    'source': doc.metadata.get('source_file', 'unknown'),
                    'type': doc.metadata.get('content_type', 'unknown'),
                    'content': doc.page_content
                })
                
                if len(code_results) >= num_results:
                    break
        
        print(f" Found {len(code_results)} code examples\n")
        return code_results
    
    def display_code_examples(self, examples):
        """
        Display code examples in a clean format
        
        Args:
            examples (list): List of code examples
        """
        if not examples:
            print("No code examples found.")
            return
        
        print("="*70)
        print("CODE EXAMPLES")
        print("="*70)
        
        for i, example in enumerate(examples, 1):
            print(f"\n[Example {i}] {example['source']}")
            print(f"{'-'*70}")
            print(example['content'])
            print(f"{'-'*70}")
        
        print("\n" + "="*70)
        sources = list(set(ex['source'] for ex in examples))
        print(f" Sources: {', '.join(sources)}")
        print("="*70)

def run_cli():
    """Interactive CLI for the retrieval agent"""
    
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║        React Documentation Retrieval Agent                    ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")
    print(" Search React documentation and get relevant code snippets")
    print(" No AI generation - just pure documentation search!\n")
    
    agent = ReactRetrievalAgent()
    
    if not agent.initialize():
        return
    
    print("Commands:")
    print("  - Type your search query (e.g., 'useState hook')")
    print("  - Type 'code: <query>' for code examples only")
    print("  - Type 'exit' to quit\n")
    
    while True:
        try:
            user_input = input("\n\033[94mSearch:\033[0m ")
            query = user_input.strip()
            
            if query.lower() in ['exit', 'quit', 'q']:
                print("\n Goodbye!")
                break
            
            if not query:
                continue
            
            # Check if user wants code examples only
            if query.lower().startswith('code:'):
                search_query = query[5:].strip()
                examples = agent.get_code_examples(search_query, num_results=3)
                agent.display_code_examples(examples)
            else:
                # Regular search
                results = agent.search(query, num_results=5, show_full=False)
                agent.display_results(results)
        
        except KeyboardInterrupt:
            print("\n\n Goodbye!")
            break
        except Exception as e:
            print(f"\n Error: {e}")

if __name__ == '__main__':
    run_cli()