import os
import sys
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")
SALES_DATA_DIR = os.getenv("SALES_DATA_DIR", "./sales")

missing = [k for k, v in {
    "DB_HOST": DB_HOST, 
    "DB_PORT": DB_PORT, 
    "DB_NAME": DB_NAME, 
    "DB_USER": DB_USER, 
    "DB_PASSWORD": DB_PASSWORD
}.items() if not v]

if missing:
    print(f"Error: Missing database credentials {missing} in .env file. Please check .env.example.")
    sys.exit(1)

import urllib.parse

# Construct PostgreSQL connection string
encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
connection_str = f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(connection_str)

def import_table(file_name, table_name, rename_dict=None):
    file_path = os.path.join(SALES_DATA_DIR, file_name)
    if not os.path.exists(file_path):
        print(f"Warning: File {file_path} not found. Skipping table {table_name}.")
        return

    print(f"Reading {file_name}...")
    df = pd.read_csv(file_path)
    
    if rename_dict:
        df = df.rename(columns=rename_dict)
        
    print(f"Uploading {len(df)} rows to table '{table_name}'...")
    try:
        # Write to PostgreSQL database
        df.to_sql(table_name, con=engine, if_exists='append', index=False, chunksize=5000)
        print(f"Successfully imported table '{table_name}'.")
    except Exception as e:
        print(f"Error importing table '{table_name}': {e}")

def run_schema_setup():
    print("Running schema_setup.sql DDL script to initialize tables...")
    sql_file_path = os.path.join("sql", "schema_setup.sql")
    if not os.path.exists(sql_file_path):
        print(f"Error: {sql_file_path} not found.")
        sys.exit(1)
        
    with open(sql_file_path, "r") as f:
        sql_content = f.read()
        
    conn = engine.raw_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        print("Schema setup completed successfully.")
    except Exception as e:
        print(f"Error executing schema_setup.sql: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_schema_setup()
    print("Starting data import to Supabase PostgreSQL...")
    
    # 1. Customers
    import_table(
        "Customers.csv", 
        "customers", 
        rename_dict={
            "Customer Index": "customer_index", 
            "Customer Names": "customer_names"
        }
    )
    
    # 2. Products
    import_table(
        "Products.csv", 
        "products", 
        rename_dict={
            "Index": "product_index", 
            "Product Name": "product_name"
        }
    )
    
    # 3. Regions
    # Columns in Regions.csv already match the table columns exactly
    import_table(
        "Regions.csv", 
        "regions"
    )
    
    # 4. State Regions
    import_table(
        "State_Regions.csv", 
        "state_regions", 
        rename_dict={
            "State Code": "state_code",
            "State": "state",
            "Region": "region"
        }
    )
    
    # 5. Sales Orders
    # Note: Using sales_order.csv (lower case) as listed in the user's directory
    import_table(
        "sales_order.csv", 
        "sales_orders", 
        rename_dict={
            "OrderNumber": "order_number",
            "OrderDate": "order_date",
            "Customer Name Index": "customer_name_index",
            "Channel": "channel",
            "Currency Code": "currency_code",
            "Warehouse Code": "warehouse_code",
            "Delivery Region Index": "delivery_region_index",
            "Product Description Index": "product_description_index",
            "Order Quantity": "order_quantity",
            "Unit Price": "unit_price",
            "Line Total": "line_total",
            "Total Unit Cost": "total_unit_cost"
        }
    )
    
    print("\nData import finished!")
