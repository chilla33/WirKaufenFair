"""
Open Food Facts API client
https://world.openfoodfacts.org
"""
import requests
from typing import Optional, Dict, Any


class OpenFoodFactsClient:
    BASE_URL = "https://world.openfoodfacts.org/api/v2"
    
    def __init__(self, user_agent: str = "WirKaufenFair/1.0"):
        self.user_agent = user_agent
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})
    
    def get_product(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        Get product info by barcode (EAN/GTIN).
        Returns None if not found, else a dict with product data.
        """
        url = f"{self.BASE_URL}/product/{barcode}"
        try:
            resp = self.session.get(url, timeout=10, verify=False)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == 1:
                return data.get("product")
            return None
        except Exception as e:
            print(f"Error fetching product {barcode}: {e}")
            return None
    
    def search_products(self, query: str, page: int = 1, page_size: int = 20) -> list:
        """
        Search products by query string.
        Returns list of products.
        """
        url = f"{self.BASE_URL}/search"
        params = {
            "search_terms": query,
            "page": page,
            "page_size": page_size,
            "json": 1
        }
        try:
            resp = self.session.get(url, params=params, timeout=10, verify=False)
            resp.raise_for_status()
            data = resp.json()
            return data.get("products", [])
        except Exception as e:
            print(f"Error searching products: {e}")
            return []
