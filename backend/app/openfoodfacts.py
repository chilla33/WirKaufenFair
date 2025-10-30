"""
Open Food Facts API client
https://world.openfoodfacts.org

Improvements: configurable timeout and simple retry/backoff for transient network errors.
"""
import os
import time
import requests
from typing import Optional, Dict, Any
from requests.exceptions import ReadTimeout, RequestException


class OpenFoodFactsClient:
    BASE_URL = "https://world.openfoodfacts.org/api/v2"
    # configurable via environment
    TIMEOUT = int(os.getenv('OFF_TIMEOUT', '10'))
    RETRIES = int(os.getenv('OFF_RETRIES', '3'))
    BACKOFF_FACTOR = float(os.getenv('OFF_BACKOFF', '0.5'))

    def __init__(self, user_agent: str = "WirKaufenFair/1.0"):
        self.user_agent = user_agent
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})

    def _get_with_retries(self, url: str, **kwargs):
        """Perform a GET with simple retry/backoff on ReadTimeouts."""
        for attempt in range(1, self.RETRIES + 1):
            try:
                resp = self.session.get(url, timeout=self.TIMEOUT, **kwargs)
                resp.raise_for_status()
                return resp
            except ReadTimeout as e:
                if attempt < self.RETRIES:
                    wait = self.BACKOFF_FACTOR * (2 ** (attempt - 1))
                    print(f"OFF request timeout (attempt {attempt}/{self.RETRIES}), retrying in {wait}s")
                    time.sleep(wait)
                    continue
                print(f"OFF request timeout after {self.RETRIES} attempts: {e}")
                raise
            except RequestException as e:
                # Non-timeout network/HTTP error — no retry for now
                print(f"OFF request failed: {e}")
                raise

    def get_product(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        Get product info by barcode (EAN/GTIN).
        Returns None if not found, else a dict with product data.
        """
        url = f"{self.BASE_URL}/product/{barcode}"
        try:
            resp = self._get_with_retries(url, verify=False)
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
            resp = self._get_with_retries(url, params=params, verify=False)
            data = resp.json()
            return data.get("products", [])
        except ReadTimeout:
            # already logged in _get_with_retries
            return []
        except Exception as e:
            print(f"Error searching products: {e}")
            return []
