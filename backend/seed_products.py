"""
Seed script to populate test data with product sizes for shopping list testing.
Run: python backend/seed_products.py
"""
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal, engine
from app.product_models import ProductLocation, Base
import datetime

# Drop and recreate tables to ensure schema is up-to-date
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("✅ Tables recreated with updated schema")

def seed_products():
    db = SessionLocal()
    
    # Sample products with sizes and prices
    products = [
        # Milchprodukte
        {"product_identifier": "Joghurt Griechisch 150g", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal A", "size_amount": 150, "size_unit": "g", "current_price": 0.99, "price_history": [{"date": "2025-10-01", "price": 1.09}, {"date": "2025-10-15", "price": 0.99}], "status": "verified"},
        {"product_identifier": "Bio Joghurt Natur 125g", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal A", "size_amount": 125, "size_unit": "g", "current_price": 0.79, "price_history": [{"date": "2025-09-01", "price": 0.89}, {"date": "2025-10-01", "price": 0.79}], "status": "verified"},
        {"product_identifier": "Danone Jogurt Erdbeere 150g", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal B", "size_amount": 150, "size_unit": "g", "current_price": 1.19, "price_history": [{"date": "2025-10-01", "price": 1.19}]},
        {"product_identifier": "Milch Frisch 1L", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal C", "size_amount": 1, "size_unit": "L", "current_price": 1.29, "price_history": [{"date": "2025-09-15", "price": 1.39}, {"date": "2025-10-15", "price": 1.29}]},
        {"product_identifier": "Öko Milch Fettarm 1L", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal C", "size_amount": 1, "size_unit": "L", "current_price": 1.49, "price_history": [{"date": "2025-10-01", "price": 1.49}]},
        {"product_identifier": "Weihenstephan H-Milch 1,5L", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal C", "size_amount": 1.5, "size_unit": "L", "current_price": 1.99, "price_history": [{"date": "2025-09-01", "price": 2.09}, {"date": "2025-10-01", "price": 1.99}]},
        {"product_identifier": "Käse Gouda 200g", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal D", "size_amount": 200, "size_unit": "g", "current_price": 2.49, "price_history": [{"date": "2025-10-01", "price": 2.49}]},
        {"product_identifier": "Butter 250g", "store_name": "REWE City", "aisle": "Gang 3", "shelf_label": "Regal D", "size_amount": 250, "size_unit": "g", "current_price": 1.79, "price_history": [{"date": "2025-09-01", "price": 1.99}, {"date": "2025-10-01", "price": 1.79}]},
        
        # Brot
        {"product_identifier": "Vollkornbrot 500g", "store_name": "REWE City", "aisle": "Gang 1", "shelf_label": "Regal A", "size_amount": 500, "size_unit": "g", "current_price": 1.99, "price_history": [{"date": "2025-10-01", "price": 1.99}]},
        {"product_identifier": "Weißbrot Toast 400g", "store_name": "REWE City", "aisle": "Gang 1", "shelf_label": "Regal A", "size_amount": 400, "size_unit": "g", "current_price": 1.49, "price_history": [{"date": "2025-10-01", "price": 1.49}]},
        
        # Obst
        {"product_identifier": "Äpfel 1kg", "store_name": "REWE City", "aisle": "Gang 5", "shelf_label": "Obst", "size_amount": 1, "size_unit": "kg", "current_price": 2.49, "price_history": [{"date": "2025-09-01", "price": 2.99}, {"date": "2025-10-01", "price": 2.49}]},
        {"product_identifier": "Bananen 1kg", "store_name": "REWE City", "aisle": "Gang 5", "shelf_label": "Obst", "size_amount": 1, "size_unit": "kg", "current_price": 1.99, "price_history": [{"date": "2025-09-15", "price": 1.79}, {"date": "2025-10-01", "price": 1.99}]},
        {"product_identifier": "Orangen 1,5kg", "store_name": "REWE City", "aisle": "Gang 5", "shelf_label": "Obst", "size_amount": 1.5, "size_unit": "kg", "current_price": 3.49, "price_history": [{"date": "2025-10-01", "price": 3.49}]},
        
        # Getränke
        {"product_identifier": "Wasser Mineralwasser 1,5L", "store_name": "REWE City", "aisle": "Gang 7", "shelf_label": "Getränke", "size_amount": 1.5, "size_unit": "L", "current_price": 0.39, "price_history": [{"date": "2025-09-15", "price": 0.49}, {"date": "2025-10-01", "price": 0.39}]},
        {"product_identifier": "Cola 1L", "store_name": "REWE City", "aisle": "Gang 7", "shelf_label": "Getränke", "size_amount": 1, "size_unit": "L", "current_price": 1.29, "price_history": [{"date": "2025-10-01", "price": 1.29}]},
        {"product_identifier": "Orangensaft 1L", "store_name": "REWE City", "aisle": "Gang 7", "shelf_label": "Getränke", "size_amount": 1, "size_unit": "L", "current_price": 1.99, "price_history": [{"date": "2025-10-01", "price": 1.99}]},
        {"product_identifier": "Kaffee 500g", "store_name": "REWE City", "aisle": "Gang 2", "shelf_label": "Regal B", "size_amount": 500, "size_unit": "g", "current_price": 5.99, "price_history": [{"date": "2025-09-01", "price": 6.49}, {"date": "2025-10-01", "price": 5.99}]},
        
        # Süßwaren
        {"product_identifier": "Nutella 400g", "store_name": "REWE City", "aisle": "Gang 4", "shelf_label": "Regal C", "size_amount": 400, "size_unit": "g", "current_price": 3.99, "price_history": [{"date": "2025-09-15", "price": 4.49}, {"date": "2025-10-15", "price": 3.99}]},
        {"product_identifier": "Ferrero Schokolade 100g", "store_name": "REWE City", "aisle": "Gang 4", "shelf_label": "Regal C", "size_amount": 100, "size_unit": "g", "current_price": 1.49, "price_history": [{"date": "2025-10-01", "price": 1.49}]},
    ]
    
    # Add products
    for p_data in products:
        existing = db.query(ProductLocation).filter(
            ProductLocation.product_identifier == p_data["product_identifier"],
            ProductLocation.store_name == p_data["store_name"]
        ).first()
        
        if not existing:
            product = ProductLocation(**p_data, contributor="Seed Script", created_at=datetime.datetime.utcnow())
            db.add(product)
            print(f"✅ Added: {p_data['product_identifier']}")
        else:
            print(f"⏭️  Skipped (exists): {p_data['product_identifier']}")
    
    db.commit()
    db.close()
    print("\n🎉 Seeding completed!")

if __name__ == "__main__":
    seed_products()
