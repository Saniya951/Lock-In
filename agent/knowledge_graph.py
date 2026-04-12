import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

class KnowledgeGraphManager:
    def __init__(self):
        # Local URI is bolt://localhost:7687
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USERNAME", "neo4j")
        pwd = os.getenv("NEO4J_PASSWORD")

        self.driver = GraphDatabase.driver(uri, auth=(user, pwd))

    def close(self):
        self.driver.close()

    def update_user_knowledge(self, session_id, project_summary):
        with self.driver.session() as session:
            session.execute_write(self._create_relationships, session_id, project_summary)
        print("✅ Knowledge Graph updated successfully.")

    @staticmethod
    def _create_relationships(tx, session_id, summary):
        query = """
        // 1. Ensure User exists
        MERGE (u:User {id: $session_id})
        
        WITH u
        UNWIND $tech_stacks as stack
        
        // 2. Use native toUpper() to standardize TechStack names 
        // This avoids the APOC dependency error
        WITH u, stack, toUpper(stack.name) as tech_name
        MERGE (ts:TechStack {name: tech_name})
        MERGE (u)-[:INTERESTED_IN]->(ts)
        
        WITH u, ts, stack
        UNWIND stack.concepts as concept_name
        // 3. Create Concepts and link them strictly to their TechStack
        MERGE (c:Concept {name: concept_name})
        MERGE (ts)-[:CONTAINS]->(c)
        
        // 4. Record User learning progress
        MERGE (u)-[r:LEARNED]->(c)
        ON CREATE SET r.count = 1, r.first_learned = timestamp(), r.last_seen = timestamp()
        ON MATCH SET r.count = r.count + 1, r.last_seen = timestamp()
        """
        tx.run(query, 
               session_id=session_id, 
               tech_stacks=summary.get("tech_stacks", []))

    # In knowledge_graph.py

    def get_user_level(self, session_id):
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (u:User {id: $session_id})-[r:LEARNED]->(c:Concept) 
                RETURN c.name as concept, r.count as count, r.last_seen as last_seen
                """,
                session_id=session_id
            )
            # Return a list of dicts instead of just strings
            return [
                {
                    "name": record["concept"], 
                    "count": record["count"],
                    "last_seen": record["last_seen"]
                } 
                for record in result
            ]