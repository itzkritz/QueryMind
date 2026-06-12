import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")

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

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def fetch_schema_info():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Query all columns in the public schema
    columns_query = """
        SELECT 
            table_name, column_name, data_type, is_nullable
        FROM 
            information_schema.columns
        WHERE 
            table_schema = 'public'
            AND table_name IN ('customers', 'products', 'regions', 'state_regions', 'sales_orders')
        ORDER BY 
            table_name, ordinal_position;
    """
    
    # Query primary keys
    pk_query = """
        SELECT 
            kcu.table_name,
            kcu.column_name
        FROM 
            information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
        WHERE 
            tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public';
    """
    
    # Query foreign keys and relationships
    fk_query = """
        SELECT
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public';
    """
    
    try:
        # Fetch columns
        cursor.execute(columns_query)
        columns = cursor.fetchall()
        
        # Fetch primary keys
        cursor.execute(pk_query)
        pks = cursor.fetchall()
        pk_dict = {row['table_name']: row['column_name'] for row in pks}
        
        # Fetch foreign keys
        cursor.execute(fk_query)
        fks = cursor.fetchall()
        fk_dict = {}
        for row in fks:
            fk_dict[(row['table_name'], row['column_name'])] = (row['foreign_table_name'], row['foreign_column_name'])
            
        return columns, pk_dict, fk_dict
    except Exception as e:
        print(f"Error fetching schema: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

def generate_schema_text(columns, pk_dict, fk_dict):
    # Organize columns by table
    tables = {}
    for col in columns:
        t_name = col['table_name']
        if t_name not in tables:
            tables[t_name] = []
        tables[t_name].append(col)
        
    schema_text_parts = []
    
    for table_name, cols in sorted(tables.items()):
        schema_text_parts.append(f"Table: {table_name}")
        schema_text_parts.append("Columns:")
        
        for col in cols:
            col_name = col['column_name']
            data_type = col['data_type']
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            
            # Identify Key tags
            key_tag = ""
            if pk_dict.get(table_name) == col_name:
                key_tag = ", PRIMARY KEY"
            elif (table_name, col_name) in fk_dict:
                f_table, f_col = fk_dict[(table_name, col_name)]
                key_tag = f", FOREIGN KEY -> {f_table}({f_col})"
                
            schema_text_parts.append(f"  - {col_name} ({data_type}, {nullable}{key_tag})")
            
        schema_text_parts.append("") # Empty line between tables
        
    return "\n".join(schema_text_parts)

if __name__ == "__main__":
    print("Connecting to Supabase and extracting database schema...")
    columns, pk_dict, fk_dict = fetch_schema_info()
    
    if not columns:
        print("Warning: No tables found. Make sure you have executed the schema_setup.sql script on your database.")
        sys.exit(0)
        
    schema_desc = generate_schema_text(columns, pk_dict, fk_dict)
    
    # Save schema text locally for context
    output_file = "extracted_schema.txt"
    with open(output_file, "w") as f:
        f.write(schema_desc)
        
    print(f"\n--- Extracted Schema (saved to {output_file}) ---")
    print(schema_desc)
