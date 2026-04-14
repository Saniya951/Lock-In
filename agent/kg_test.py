from knowledge_graph import KnowledgeGraphManager # assuming the file is named this

try:
    kg = KnowledgeGraphManager()
    # If the connection fails, it usually throws an AuthError or ServiceUnavailable error here
    kg.driver.verify_connectivity()
    print("✅ Successfully connected to Neo4j Aura!")
    kg.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")