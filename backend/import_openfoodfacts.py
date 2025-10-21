"""
Import products from Open Food Facts API
Run: python backend/import_openfoodfacts.py
"""
import sys
from pathlib import Path
import requests
import json
from typing import Optional, Dict, Any
import time

# Add backend to path
backend_path = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal
from app.product_models import ProductLocation
import datetime

# Open Food Facts API
OFF_API_BASE = "https://world.openfoodfacts.org/api/v2"
OFF_SEARCH = f"{OFF_API_BASE}/search"

def search_products(query: str, country: str = "de", page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    """Search products on Open Food Facts"""
    params = {
        "search_terms": query,
        "countries_tags": country,
        "page": page,
        "page_size": page_size,
        "fields": "code,product_name,product_name_de,brands,quantity,image_url,stores,categories_tags,nutriscore_grade,ecoscore_grade"
    }
    
    try:
        response = requests.get(OFF_SEARCH, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Error searching OFF: {e}")
        return {"products": []}

def extract_size_from_quantity(quantity: str) -> tuple[Optional[float], Optional[str]]:
    """Extract size amount and unit from quantity string like '150 g' or '1 L'"""
    if not quantity:
        return None, None
    
    import re
    # Match patterns like "150 g", "1.5 L", "500ml"
    match = re.search(r'([\d.,]+)\s*(g|kg|ml|l|cl|dl)', quantity.lower())
    if not match:
        return None, None
    
    amount = float(match.group(1).replace(',', '.'))
    unit = match.group(2).lower()
    
    # Normalize units
    if unit == 'kg':
        amount *= 1000
        unit = 'g'
    elif unit == 'l':
        amount *= 1000
        unit = 'ml'
    elif unit == 'cl':
        amount *= 10
        unit = 'ml'
    elif unit == 'dl':
        amount *= 100
        unit = 'ml'
    
    return amount, unit

def estimate_price(product: Dict[str, Any]) -> Optional[float]:
    """Estimate price based on product category and size (rough heuristic)"""
    # This is a placeholder - in production you'd use a price database or scraping
    categories = product.get('categories_tags', [])
    quantity = product.get('quantity', '')
    
    size_amount, size_unit = extract_size_from_quantity(quantity)
    
    # Very rough price estimates per category (EUR per base unit)
    price_per_100g = {
        'dairy': 0.50,
        'beverages': 0.15,
        'bread': 0.40,
        'fruits': 0.30,
        'vegetables': 0.25,
        'snacks': 0.80,
        'spreads': 1.00
    }
    
    base_price = 0.50  # default
    for cat, price in price_per_100g.items():
        if any(cat in tag for tag in categories):
            base_price = price
            break
    
    if size_amount and size_unit in ['g', 'ml']:
        return round((size_amount / 100) * base_price, 2)
    
    return None

def map_store_name(stores_str: str) -> str:
    """Map OFF store names to our standard names"""
    if not stores_str:
        return "REWE City"  # default
    
    stores_lower = stores_str.lower()
    if 'rewe' in stores_lower:
        return "REWE City"
    elif 'edeka' in stores_lower:
        return "EDEKA"
    elif 'aldi' in stores_lower:
        return "ALDI"
    elif 'lidl' in stores_lower:
        return "LIDL"
    else:
        return "REWE City"  # default

def import_product_from_off(product: Dict[str, Any], db, store_name: str = None, aisle: str = None) -> bool:
    """Import a single product from OFF into database"""
    
    # Extract data
    barcode = product.get('code')
    name_de = product.get('product_name_de') or product.get('product_name')
    brand = product.get('brands', '').split(',')[0].strip() if product.get('brands') else ''
    quantity = product.get('quantity', '')
    image_url = product.get('image_url')
    stores = product.get('stores', '')
    
    if not name_de or not barcode:
        return False
    
    # Build product identifier
    product_id = f"{brand} {name_de}".strip() if brand else name_de
    if quantity:
        product_id += f" {quantity}"
    
    # Extract size
    size_amount, size_unit = extract_size_from_quantity(quantity)
    
    # Estimate price
    estimated_price = estimate_price(product)
    
    # Determine store
    if not store_name:
        store_name = map_store_name(stores)
    
    # Check if already exists
    existing = db.query(ProductLocation).filter(
        ProductLocation.product_identifier == product_id,
        ProductLocation.store_name == store_name
    ).first()
    
    if existing:
        return False
    
    # Create new product
    new_product = ProductLocation(
        product_identifier=product_id,
        store_name=store_name,
        aisle=aisle or f"Gang {hash(barcode) % 7 + 1}",  # Random aisle 1-7
        shelf_label=None,
        photo_url=image_url,
        contributor="Open Food Facts Import",
        status="suggested",
        size_amount=size_amount,
        size_unit=size_unit,
        current_price=estimated_price,
        price_currency="EUR",
        price_history=None,
        created_at=datetime.datetime.utcnow()
    )
    
    db.add(new_product)
    return True

def import_category(category_query: str, store_name: str = "REWE City", max_products: int = 20):
    """Import products from a category"""
    db = SessionLocal()
    
    print(f"\n🔍 Searching for '{category_query}' in Open Food Facts...")
    data = search_products(category_query, country="de", page_size=max_products)
    products = data.get('products', [])
    
    print(f"📦 Found {len(products)} products")
    
    imported = 0
    for product in products:
        try:
            if import_product_from_off(product, db, store_name):
                name = product.get('product_name_de') or product.get('product_name')
                print(f"✅ Imported: {name}")
                imported += 1
            time.sleep(0.2)  # Rate limiting
        except Exception as e:
            print(f"❌ Error importing product: {e}")
    
    db.commit()
    db.close()
    
    print(f"\n🎉 Import completed! {imported}/{len(products)} products imported.")

def main():
    """Main import function"""
    print("=" * 60)
    print("📦 Open Food Facts Import Tool")
    print("=" * 60)
    
    # Define categories to import
    categories = [
        ("Joghurt", 15),
        ("Milch", 10),
        ("Brot", 10),
        ("Käse", 10),
        ("Schokolade", 10),
        ("Kaffee", 8),
        ("Saft", 10),
        ("Wasser", 8),
        ("Butter", 5),
        ("Müsli", 10)
    ]
    
    for category, max_items in categories:
        import_category(category, store_name="REWE City", max_products=max_items)
        time.sleep(1)  # Pause between categories
    
    print("\n" + "=" * 60)
    print("✅ All imports completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()
