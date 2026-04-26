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
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")
        self.driver = self._create_driver_with_fallback(uri, user, pwd)

    def _create_driver_with_fallback(self, uri: str, user: str, pwd: str):
        """
        Prefer strict TLS (`neo4j+s`) but gracefully fall back to `neo4j+ssc`
        for local environments where certificate verification is intercepted.
        """
        driver = GraphDatabase.driver(uri, auth=(user, pwd))
        try:
            driver.verify_connectivity()
            return driver
        except Exception as e:
            err = str(e)
            is_tls_cert_error = (
                "SSLCertVerificationError" in err
                or "Failed to establish encrypted connection" in err
                or "Unable to retrieve routing information" in err
            )

            if uri.startswith("neo4j+s://") and is_tls_cert_error:
                fallback_uri = uri.replace("neo4j+s://", "neo4j+ssc://", 1)
                print("⚠ Neo4j strict TLS verification failed on this machine; retrying Aura connection with neo4j+ssc.")
                driver.close()

                fallback_driver = GraphDatabase.driver(fallback_uri, auth=(user, pwd))
                fallback_driver.verify_connectivity()
                return fallback_driver

            driver.close()
            raise

    def close(self):
        self.driver.close()

    def update_user_knowledge(self, session_id, project_summary):
        with self.driver.session(database=self.database) as session:
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
        
        // Changed to IMPLEMENTED to denote actual coding experience
        MERGE (u)-[r:IMPLEMENTED]->(c)
        ON CREATE SET r.count = 1, r.first_learned = timestamp(), r.last_seen = timestamp()
        ON MATCH SET r.count = r.count + 1, r.last_seen = timestamp()
        """
        tx.run(query, 
               session_id=session_id, 
               tech_stacks=summary.get("tech_stacks", []))

    def record_theory_inquiry(self, session_id, summary: dict):
        """Called by learning_graph.py to log what the user is asking about."""
        if not summary.get("tech_stacks"):
            return
            
        with self.driver.session(database=self.database) as session:
            session.execute_write(self._create_study_relationships, session_id, summary)
        print("✅ KG Updated: Logged Theoretical Study and Tech Stack.")

    @staticmethod
    def _create_study_relationships(tx, session_id, summary):
        query = """
        // 1. Ensure User exists
        MERGE (u:User {id: $session_id})
        
        WITH u
        UNWIND $tech_stacks as stack
        
        // 2. Standardize TechStack and link INTERESTED_IN
        WITH u, stack, toUpper(stack.name) as tech_name
        MERGE (ts:TechStack {name: tech_name})
        MERGE (u)-[:INTERESTED_IN]->(ts)
        
        WITH u, ts, stack
        UNWIND stack.concepts as concept_name
        
        // 3. Create Concepts and link them to the TechStack
        MERGE (c:Concept {name: concept_name})
        MERGE (ts)-[:CONTAINS]->(c)
        
        // 4. Mark as STUDIED (instead of IMPLEMENTED)
        MERGE (u)-[r:STUDIED]->(c)
        ON CREATE SET r.count = 1, r.first_learned = timestamp(), r.last_seen = timestamp()
        ON MATCH SET r.count = r.count + 1, r.last_seen = timestamp()
        """
        tx.run(query, 
               session_id=session_id, 
               tech_stacks=summary.get("tech_stacks", []))

    # def record_theory_inquiry(self, session_id, concepts: list):
    #     """Called by learning_graph.py to log what the user is asking about."""
    #     if not concepts:
    #         return
            
    #     with self.driver.session() as session:
    #         session.execute_write(self._create_study_relationships, session_id, concepts)
    #     print(f"✅ KG Updated: Logged Theoretical Study for {concepts}.")

    # @staticmethod
    # def _create_study_relationships(tx, session_id, concepts):
    #     query = """
    #     MERGE (u:User {id: $session_id})
    #     WITH u
    #     UNWIND $concepts as concept_name
    #     MERGE (c:Concept {name: concept_name})
        
    #     // Use STUDIED to denote reading/asking about it
    #     MERGE (u)-[r:STUDIED]->(c)
    #     ON CREATE SET r.count = 1, r.first_asked = timestamp(), r.last_asked = timestamp()
    #     ON MATCH SET r.count = r.count + 1, r.last_asked = timestamp()
    #     """
    #     tx.run(query, session_id=session_id, concepts=concepts)


    def get_user_level(self, session_id):
        with self.driver.session(database=self.database) as session:
            result = session.run(
                """
                MATCH (u:User {id: $session_id})-[r:IMPLEMENTED|STUDIED]->(c:Concept) 
                RETURN c.name as concept, 
                       sum(r.count) as total_count, 
                       max(r.last_seen) as latest_seen, 
                       collect(type(r)) as rel_types
                //RETURN c.name as concept, r.count as count, r.last_seen as last_seen, collect(type(r)) as rel_types
                """,
                session_id=session_id
            )
            # Return a list of dicts instead of just strings
            return [
                {
                    "name": record["concept"], 
                    "count": record["total_count"],
                    "last_seen": record["latest_seen"],
                    "types": record["rel_types"]
                } 
                for record in result
            ]

    def get_user_graph(self, user_id: str) -> dict:
        with self.driver.session(database=self.database) as session:
            result = session.run(
                """
                MATCH (u:User {id: $user_id})
                OPTIONAL MATCH (u)-[:INTERESTED_IN]->(ts:TechStack)
                OPTIONAL MATCH (ts)-[:CONTAINS]->(c:Concept)
                OPTIONAL MATCH (u)-[uc:IMPLEMENTED|STUDIED]->(c)

                RETURN u.id AS user_id,
                       collect(DISTINCT {id: 'U:' + u.id, name: u.id, type: 'User'}) AS users,
                       collect(DISTINCT CASE WHEN ts IS NULL THEN NULL ELSE {id: 'T:' + ts.name, name: ts.name, type: 'TechStack'} END) AS techs,
                       collect(DISTINCT CASE WHEN c IS NULL THEN NULL ELSE {id: 'C:' + c.name, name: c.name, type: 'Concept'} END) AS concepts,
                       collect(DISTINCT CASE WHEN ts IS NULL THEN NULL ELSE {source: 'U:' + u.id, target: 'T:' + ts.name, type: 'INTERESTED_IN'} END) AS user_to_tech,
                       collect(DISTINCT CASE WHEN ts IS NULL OR c IS NULL THEN NULL ELSE {source: 'T:' + ts.name, target: 'C:' + c.name, type: 'CONTAINS'} END) AS tech_to_concept,
                       collect(DISTINCT CASE WHEN c IS NULL OR uc IS NULL THEN NULL ELSE {source: 'U:' + u.id, target: 'C:' + c.name, type: type(uc), count: coalesce(uc.count, 1)} END) AS user_to_concept
                """,
                user_id=user_id,
            ).single()

            if not result:
                return {
                    "nodes": [],
                    "links": [],
                    "stats": {"users": 0, "tech_stacks": 0, "concepts": 0, "relationships": 0},
                }

            def _clean(items):
                return [item for item in items if item is not None]

            nodes = _clean(result["users"]) + _clean(result["techs"]) + _clean(result["concepts"])
            links = _clean(result["user_to_tech"]) + _clean(result["tech_to_concept"]) + _clean(result["user_to_concept"])

            return {
                "nodes": nodes,
                "links": links,
                "stats": {
                    "users": len(_clean(result["users"])),
                    "tech_stacks": len(_clean(result["techs"])),
                    "concepts": len(_clean(result["concepts"])),
                    "relationships": len(links),
                },
            }