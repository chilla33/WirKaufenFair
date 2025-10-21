"""
Seed script: fetch products from Open Food Facts and create demo product location suggestions
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.product_models import ProductLocation
from app.openfoodfacts import OpenFoodFactsClient

# Popular German product barcodes (EAN-13)
DEMO_BARCODES = [
    "4000417025005",  # Nutella
    "4006040055501",  # Milka Schokolade
    "4005500051978",  # Haribo Goldbären
    "4104420071872",  # Coca Cola
    "4000521845506",  # Jacobs Krönung Kaffee
    "4008400401928",  # Milka Alpenmilch
    "4001686312919",  # Pringles Original
    "5000112576054",  # Mars Riegel
    "4066600204503",  # Dr. Oetker Pizz
    "4316268596206",  # Weihenstephan Milch
]

DEMO_STORES = [
    "REWE City",
    "EDEKA Neukauf",
    "Kaufland",
    "Lidl",
    "Aldi Süd"
]


def seed_products():
    client = OpenFoodFactsClient()
    db = SessionLocal()
    
    print("Fetching products from Open Food Facts...")
    
    for i, barcode in enumerate(DEMO_BARCODES):
        product = client.get_product(barcode)
        if not product:
            print(f"  ⚠ Product {barcode} not found, skipping")
            continue
        
        product_name = product.get("product_name") or product.get("product_name_de") or f"Produkt {barcode}"
        brand = product.get("brands") or ""
        
        # Create 1-2 location suggestions per product
        store = DEMO_STORES[i % len(DEMO_STORES)]
        
        pl = ProductLocation(
            product_identifier=barcode,
            store_name=store,
            aisle=f"Gang {(i % 10) + 1}",
            shelf_label=f"Regal {chr(65 + (i % 5))}",
            photo_url="",
            contributor=f"Demo User {i+1}",
            upvotes=i % 5,
            downvotes=0,
            status="suggested"
        )
        db.add(pl)
        print(f"  ✓ Added: {product_name} ({brand}) @ {store}")
    
    db.commit()
    print(f"\n✅ Seeded {len(DEMO_BARCODES)} product locations!")
    db.close()


if __name__ == "__main__":
    seed_products()
