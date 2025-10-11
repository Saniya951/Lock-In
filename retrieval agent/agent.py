"""
agent_groq.py
React code generation agent using FREE Groq API (SUPER FAST!)
Run: python agent_groq.py
"""

from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pathlib import Path
import os
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

class ReactCodeAgent:
    """
    AI Agent using FREE Groq API (blazingly fast!)
    """
    
    def __init__(self, model_name="llama-3.1-70b-versatile"):
        """
        Initialize agent with Groq model
        
        Available FREE Groq models:
        - llama-3.1-70b-versatile (best quality, very fast)
        - llama-3.1-8b-instant (fastest, good quality)
        - mixtral-8x7b-32768 (excellent for code)
        - gemma2-9b-it (Google's model)
        """
        self.model_name = model_name
        self.vector_store = None
        self.llm = None
        self.initialized = False
    
    def initialize(self):
        """Initialize the agent with Groq LLM and vector store"""
        if self.initialized:
            return True
        
        print(f" Initializing React Code Agent with Groq ({self.model_name})...")
        
        # Check for API key
        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            print(" Error: GROQ_API_KEY not found!")
            print("\n Get your free API key:")
            print("   1. Go to https://console.groq.com")
            print("   2. Sign up (free)")
            print("   3. Create API key")
            print("   4. Add to .env file: GROQ_API_KEY=your_key_here")
            return False
        
        # Check if vector store exists
        if not Path('./chroma_db').exists():
            print(" Error: Vector store not found!")
            print("Please run 'python setup_vectordb_groq.py' first.")
            return False
        
        try:
            # Initialize embeddings (local, free)
            print(" Loading local embeddings...")
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
            
            # Initialize Groq LLM (cloud, free & fast!)
            print(f" Connecting to Groq API...")
            self.llm = ChatGroq(
                model=self.model_name,
                temperature=0.2,
                groq_api_key=api_key,
                max_tokens=2048,
            )
            
            self.initialized = True
            print(" Agent initialized!\n")
            print(" Using Groq - expect FAST responses (2-5 seconds)!\n")
            return True
            
        except Exception as e:
            print(f" Error initializing: {e}")
            return False
    
    def generate_code(self, user_prompt, num_sources=5, include_explanation=True):
        """
        Generate React code based on user prompt
        
        Args:
            user_prompt (str): User's request
            num_sources (int): Number of doc chunks to retrieve
            include_explanation (bool): Whether to include explanation
            
        Returns:
            dict: Generated code, sources, and timing info
        """
        if not self.initialized:
            if not self.initialize():
                return None
        
        start_time = time.time()
        
        print(f" Searching documentation for: '{user_prompt}'")
        
        # Step 1: Retrieve relevant documentation
        relevant_docs = self.vector_store.similarity_search(
            user_prompt,
            k=num_sources
        )
        
        search_time = time.time() - start_time
        print(f"✓ Found {len(relevant_docs)} relevant chunks ({search_time:.2f}s)\n")
        
        # Step 2: Format context
        context = self._format_context(relevant_docs)
        
        # Step 3: Create prompt template
        if include_explanation:
            explanation_instruction = "7. Provide a brief explanation of the code after generating it"
        else:
            explanation_instruction = ""
        
        template = f"""You are an expert React developer. Generate React code based on the official React documentation provided below.

OFFICIAL REACT DOCUMENTATION:
{{context}}

USER REQUEST:
{{question}}

INSTRUCTIONS:
1. Use modern React best practices (functional components, hooks)
2. Follow the patterns shown in the documentation above
3. Generate complete, runnable code
4. Include necessary imports
5. Add helpful comments
6. If the request is unclear, make reasonable assumptions based on common React patterns
{explanation_instruction}

Generate the React code now:"""
        
        prompt = PromptTemplate(
            template=template,
            input_variables=["context", "question"]
        )
        
        prompt = PromptTemplate(
            template=template,
            input_variables=["context", "question"]
        )
        
        # Step 4: Create and run chain
        chain = prompt | self.llm | StrOutputParser()
        
        print(" Generating code with Groq...")
        
        gen_start = time.time()
        result = chain.invoke({
            "context": context,
            "question": user_prompt
        })
        gen_time = time.time() - gen_start
        
        total_time = time.time() - start_time
        
        # Step 5: Extract sources
        sources = self._extract_sources(relevant_docs)
        
        print(f" Generated in {gen_time:.2f}s")
        print(f" Total time: {total_time:.2f}s\n")
        
        return {
            'code': result,
            'sources': sources,
            'generation_time': gen_time,
            'search_time': search_time,
            'total_time': total_time,
            'relevant_docs': [
                {
                    'content': doc.page_content[:200] + '...',
                    'metadata': doc.metadata
                }
                for doc in relevant_docs
            ]
        }
    
    def _format_context(self, docs):
        """Format retrieved documents into context string"""
        context_parts = []
        for i, doc in enumerate(docs, 1):
            source_file = doc.metadata.get('source_file', 'unknown')
            context_parts.append(
                f"--- Source {i}: {source_file} ---\n{doc.page_content}\n"
            )
        return '\n'.join(context_parts)
    
    def _extract_sources(self, docs):
        """Extract unique source files from documents"""
        sources = set()
        for doc in docs:
            source_file = doc.metadata.get('source_file', 'unknown')
            sources.add(source_file)
        return list(sources)
    
    def search_docs(self, query, num_results=5):
        """Search documentation without generating code"""
        if not self.initialized:
            if not self.initialize():
                return []
        
        results = self.vector_store.similarity_search(query, k=num_results)
        
        return [
            {
                'content': doc.page_content,
                'source': doc.metadata.get('source_file', 'unknown'),
                'type': doc.metadata.get('content_type', 'unknown')
            }
            for doc in results
        ]

def run_cli():
    """Interactive CLI for the agent"""
    
    print("╔════════════════════════════════════════╗")
    print("║   React Code Agent with Groq           ║")
    print("╚════════════════════════════════════════╝\n\n")
    print("Available models:")
    print("  1. llama-3.1-70b-versatile (best quality)")
    print("  2. llama-3.1-8b-instant (fastest)")
    print("  3. mixtral-8x7b-32768 (great for code)")
    print("")
    
    model_choice = input("Choose model (1-3) or press Enter for default [1]: ").strip()
    
    model_map = {
        '1': 'llama-3.1-70b-versatile',
        '2': 'llama-3.1-8b-instant',
        '3': 'mixtral-8x7b-32768',
        '': 'llama-3.1-70b-versatile'
    }
    
    model_name = model_map.get(model_choice, 'llama-3.1-70b-versatile')
    print(f"\n Using: {model_name}\n")
    
    agent = ReactCodeAgent(model_name=model_name)
    
    if not agent.initialize():
        return
    
    print("Enter your React code request (or 'exit' to quit):\n")
    
    while True:
        try:
            user_input = input("\n\033[94mYou:\033[0m ")
            prompt = user_input.strip()
            
            if prompt.lower() in ['exit', 'quit', 'q']:
                print("\n Goodbye!")
                break
            
            if not prompt:
                continue
            
            # Generate code
            result = agent.generate_code(prompt)
            
            if result:
                print("\n" + "="*60)
                print("GENERATED CODE:")
                print("="*60)
                print(result['code'])
                print("\n" + "="*60)
                print(f" Sources: {', '.join(result['sources'])}")
                print(f" Speed: {result['generation_time']:.2f}s")
                print("="*60)
        
        except KeyboardInterrupt:
            print("\n\n Goodbye!")
            break
        except Exception as e:
            print(f"\n Error: {e}")

if __name__ == '__main__':
    run_cli()