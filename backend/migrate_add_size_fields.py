"""
Migration: Add size_amount and size_unit columns to product_locations table
Run: python backend/migrate_add_size_fields.py
"""
import sqlite3
from pathlib import Path

# Database path
DB_PATH = Path(__file__).resolve().parent / 'wirkaufenfair.db'

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(product_locations)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'size_amount' not in columns:
            print("Adding size_amount column...")
            cursor.execute("ALTER TABLE product_locations ADD COLUMN size_amount REAL")
            print("✅ size_amount column added")
        else:
            print("⏭️  size_amount column already exists")
        
        if 'size_unit' not in columns:
            print("Adding size_unit column...")
            cursor.execute("ALTER TABLE product_locations ADD COLUMN size_unit VARCHAR(20)")
            print("✅ size_unit column added")
        else:
            print("⏭️  size_unit column already exists")
        
        conn.commit()
        print("\n🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
