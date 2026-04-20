"""
Lightweight script to create Qdrant collections only.
No sentence-transformers or data files required.
"""
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

QDRANT_URL = "https://4252fbd0-800c-46ef-9748-3e52c7b9f434.eu-central-1-0.aws.cloud.qdrant.io"
QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6ZjIyYzNmNzEtODFhMy00ZDQ5LWFhNWMtNDU4NjEyNjg2N2NkIn0.ZcoJHD5QMW3BtI6X9we8YU968bGFGnD6e5xnqHxtcJU"
VECTOR_DIM = 384  # MiniLM output dimension

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# Verify connection
collections = client.get_collections()
print(f"Connected. Existing collections: {[c.name for c in collections.collections]}")

# Create the 3 collections
for name in ["rag_knowledge", "student_gaps", "gap_statistics"]:
    client.recreate_collection(
        collection_name=name,
        vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
    )
    print(f"Created collection: {name}")

# Verify
collections = client.get_collections()
print(f"\nAll collections: {[c.name for c in collections.collections]}")
print("Done!")
