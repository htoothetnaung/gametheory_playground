"""
Embedding service for semantic distance calculations.
Supports: Ollama (local, free) or OpenRouter (API fallback)

Game Theory Application (Straffin Ch.3):
- Calculates cosine similarity between clues and secret word
- Enables "Mixed Strategy" evaluation: clues in 0.4-0.6 range are optimal
"""
import os
import httpx
import numpy as np
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class EmbeddingService:
    """
    Manages word embeddings for semantic distance calculations.
    
    Theory: This implements the mathematical foundation for evaluating
    the "risk" of civilian clues per Straffin's mixed strategy concept.
    """
    
    def __init__(self):
        self.provider = os.getenv("EMBEDDING_PROVIDER", "ollama")
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        
        # Cache embeddings to avoid redundant API calls
        self._cache: dict[str, np.ndarray] = {}
    
    async def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Get embedding vector for text.
        Returns numpy array of shape (dim,) or None on failure.
        """
        # Check cache first
        cache_key = f"{self.provider}:{text.lower().strip()}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        embedding = None
        
        if self.provider == "ollama":
            embedding = await self._get_ollama_embedding(text)
        
        # Fallback to OpenRouter if Ollama fails or not configured
        if embedding is None and self.openrouter_api_key:
            embedding = await self._get_openrouter_embedding(text)
        
        if embedding is not None:
            self._cache[cache_key] = embedding
        
        return embedding
    
    async def _get_ollama_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding from local Ollama instance"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.ollama_base_url}/api/embeddings",
                    json={
                        "model": self.ollama_model,
                        "prompt": text
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return np.array(data["embedding"])
                else:
                    print(f"Ollama error: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"Ollama connection failed: {e}")
            return None
    
    async def _get_openrouter_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding from OpenRouter API (fallback)"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.openrouter_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "thenlper/gte-base",
                        "input": text
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return np.array(data["data"][0]["embedding"])
                else:
                    print(f"OpenRouter error: {response.status_code}")
                    return None
        except Exception as e:
            print(f"OpenRouter failed: {e}")
            return None
    
    def cosine_similarity(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors.
        Returns value in range [0, 1] where 1 = identical, 0 = orthogonal.
        
        Game Theory Application:
        - 0.0 = Clue is totally unrelated (suspicious, looks like imposter)
        - 0.4-0.6 = "Sweet Spot" / Nash Equilibrium (safe civilian strategy)
        - 1.0 = Clue is too similar (leaks information to imposter)
        """
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        similarity = np.dot(vec_a, vec_b) / (norm_a * norm_b)
        # Clamp to [0, 1] range (cosine can be negative for opposite vectors)
        return float(max(0.0, min(1.0, (similarity + 1) / 2)))
    
    async def calculate_semantic_distance(
        self, 
        clue: str, 
        secret_word: str
    ) -> tuple[float, str]:
        """
        Calculate semantic distance and risk level for a clue.
        
        Returns:
            tuple: (similarity: float, risk_level: str)
            
        Risk Levels (per Game Theory Mixed Strategy):
        - dangerous (>0.85): Clue reveals too much - imposter wins
        - risky (>0.6): Clue is too close - information leakage
        - moderate (0.35-0.6): Optimal mixed strategy zone
        - safe (<0.35): Clue is vague - but may look suspicious
        """
        clue_embedding = await self.get_embedding(clue)
        word_embedding = await self.get_embedding(secret_word)
        
        if clue_embedding is None or word_embedding is None:
            # Fallback to simple heuristic if embeddings fail
            return self._fallback_similarity(clue, secret_word)
        
        similarity = self.cosine_similarity(clue_embedding, word_embedding)
        risk_level = self._get_risk_level(similarity)
        
        return similarity, risk_level
    
    def _get_risk_level(self, similarity: float) -> str:
        """Determine risk level based on semantic similarity"""
        if similarity > 0.85:
            return "dangerous"
        elif similarity > 0.6:
            return "risky"
        elif similarity > 0.35:
            return "moderate"
        else:
            return "safe"
    
    def _fallback_similarity(self, clue: str, secret_word: str) -> tuple[float, str]:
        """
        Simple fallback when embeddings unavailable.
        Uses character-level and word overlap heuristics.
        """
        clue_lower = clue.lower()
        word_lower = secret_word.lower()
        
        # Direct match = maximum danger
        if word_lower in clue_lower or clue_lower in word_lower:
            return 0.95, "dangerous"
        
        # Check for shared substrings (3+ chars)
        for i in range(len(word_lower) - 2):
            if word_lower[i:i+3] in clue_lower:
                return 0.7, "risky"
        
        # First letter match
        if clue_lower[0] == word_lower[0]:
            return 0.5, "moderate"
        
        return 0.3, "safe"
    
    def clear_cache(self):
        """Clear embedding cache"""
        self._cache.clear()

    async def project_texts_to_2d(
        self,
        items: list[dict],
        method: str = "pca",
    ) -> list[dict]:
        """
        Project text embeddings into 2D with PCA or t-SNE.

        items fields:
          - text: raw text to embed
          - label: point label
          - type: secret | civilian_clue | imposter_clue
          - distance: optional semantic similarity metadata
        """
        if not items:
            return []

        embeddings = []
        valid_items = []
        for item in items:
            vec = await self.get_embedding(item.get("text", ""))
            if vec is not None:
                embeddings.append(vec)
                valid_items.append(item)

        if not embeddings:
            return []

        matrix = np.vstack(embeddings)
        points_2d = None

        if matrix.shape[0] == 1:
            points_2d = np.array([[0.0, 0.0]])
        else:
            if method.lower() == "tsne":
                try:
                    import importlib

                    sklearn_manifold = importlib.import_module("sklearn.manifold")
                    TSNE = getattr(sklearn_manifold, "TSNE")

                    perplexity = min(30, max(2, matrix.shape[0] - 1))
                    tsne = TSNE(n_components=2, random_state=42, perplexity=perplexity)
                    points_2d = tsne.fit_transform(matrix)
                except Exception:
                    points_2d = None

            if points_2d is None:
                centered = matrix - np.mean(matrix, axis=0)
                _, _, vt = np.linalg.svd(centered, full_matrices=False)
                components = vt[:2].T
                points_2d = centered @ components

        max_abs = float(np.max(np.abs(points_2d))) if points_2d.size > 0 else 1.0
        scale = max(max_abs, 1e-6)
        normalized = points_2d / scale

        vectors = []
        for idx, item in enumerate(valid_items):
            vectors.append(
                {
                    "x": float(normalized[idx][0]),
                    "y": float(normalized[idx][1]),
                    "label": item.get("label", item.get("text", "")),
                    "type": item.get("type", "civilian_clue"),
                    "distance": item.get("distance"),
                }
            )
        return vectors


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the embedding service singleton"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
