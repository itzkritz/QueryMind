import streamlit as st
import pandas as pd
import os
from sql_generator import SQLGenerator, _get_schema_text

# Page Config
st.set_page_config(
    page_title="QueryMind - Text to SQL Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Premium Styling
st.markdown("""
    <style>
        /* Gradient header */
        .title-container {
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 0.2rem;
            text-align: left;
        }
        
        .subtitle-container {
            color: #9ca3af;
            font-size: 1.1rem;
            margin-bottom: 2rem;
        }

        /* Glassmorphic Cards */
        .glass-card {
            background: rgba(17, 24, 39, 0.7);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
        }

        .sql-header {
            color: #a855f7;
            font-weight: 700;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        /* Sidebar styling */
        section[data-testid="stSidebar"] {
            background-color: #0d111d !important;
            border-right: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Accent badges */
        .badge {
            display: inline-block;
            padding: 0.25rem 0.6rem;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 50px;
            text-transform: uppercase;
        }
        
        .badge-success {
            background-color: rgba(16, 185, 129, 0.15);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .badge-warning {
            background-color: rgba(245, 158, 11, 0.15);
            color: #f59e0b;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }
    </style>
""", unsafe_allow_html=True)

# ── Sidebar Configurations ───────────────────────────────────────────────────
st.sidebar.image("https://img.icons8.com/gradient/96/database.png", width=60)
st.sidebar.markdown("<h2 style='margin-top:0;'>QueryMind Panel</h2>", unsafe_allow_html=True)

st.sidebar.subheader("🔌 LLM Settings")
provider = st.sidebar.selectbox(
    "Choose LLM Provider:",
    options=["Gemini", "Ollama"],
    index=0
)

# Display active credentials status
st.sidebar.subheader("🔒 Connection Status")
google_key = os.getenv("GOOGLE_API_KEY")
db_host = os.getenv("DB_HOST")

if db_host:
    st.sidebar.markdown('<span class="badge badge-success">✓ Supabase Connected</span>', unsafe_allow_html=True)
else:
    st.sidebar.markdown('<span class="badge badge-warning">⚠ No Database Configured</span>', unsafe_allow_html=True)

if provider == "Gemini":
    if google_key and google_key.startswith("AIza"):
        st.sidebar.markdown('<span class="badge badge-success">✓ Gemini Key Valid</span>', unsafe_allow_html=True)
    else:
        st.sidebar.markdown('<span class="badge badge-warning">⚠ Invalid Gemini Key</span>', unsafe_allow_html=True)
elif provider == "Ollama":
    st.sidebar.markdown('<span class="badge badge-success">✓ Local Ollama API</span>', unsafe_allow_html=True)

# Expandable Schema Viewer in Sidebar
st.sidebar.subheader("📊 Database Schema")
with st.sidebar.expander("Explore Tables & Relations"):
    try:
        schema_info = _get_schema_text()
        st.code(schema_info, language="text")
    except Exception as e:
        st.error(f"Error fetching schema: {e}")

# ── Main Panel ───────────────────────────────────────────────────────────────
st.markdown("<div class='title-container'>QueryMind</div>", unsafe_allow_html=True)
st.markdown("<div class='subtitle-container'>Ask natural language questions and get live results from your Supabase PostgreSQL Database</div>", unsafe_allow_html=True)

# Setup Generator
@st.cache_resource
def get_generator(prov_name):
    return SQLGenerator(provider=prov_name)

try:
    generator = get_generator(provider)
except Exception as e:
    st.error(f"Failed to initialize generator: {e}")
    st.stop()

# Initialize session state for user_query if not present
if "user_query" not in st.session_state:
    st.session_state.user_query = ""

# Sample Presets Grid
st.markdown("### 💡 Quick Queries")
presets = [
    "What is the total revenue by channel?",
    "Show the names of the top 5 products by quantity ordered",
    "What is the average unit price per warehouse?",
    "Who are the top 5 customers by total spending?",
]

col1, col2 = st.columns(2)
with col1:
    if st.button("📈 Revenue per Sales Channel"):
        st.session_state.user_query = presets[0]
    if st.button("📦 Top 5 Best Selling Products"):
        st.session_state.user_query = presets[1]
with col2:
    if st.button("🏢 Average Price by Warehouse"):
        st.session_state.user_query = presets[2]
    if st.button("👤 Top 5 Customers by Spending"):
        st.session_state.user_query = presets[3]

st.markdown("---")

# Question Input Form
with st.form("query_form"):
    st.text_area(
        "Enter your question in plain English:",
        key="user_query",
        placeholder="e.g. Find total order amount for each state in the South region",
        height=100
    )
    submit_button = st.form_submit_button("Generate & Run Query ⚡")

# Run Pipeline
user_query = st.session_state.user_query
if submit_button and user_query:
    with st.spinner("Analyzing schema and generating query..."):
        result = generator.query(user_query)
        
    if result["error"]:
        if not result.get("validated", True):
            st.markdown("""
                <div style="background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 1rem; color: #f87171; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    🛡️ <b>Safety Check Failed:</b> The query did not pass validation.
                </div>
            """, unsafe_allow_html=True)
        st.error(f"❌ Pipeline Error: {result['error']}")
        if result["sql"]:
            st.markdown("### Generated SQL Attempt")
            st.code(result["sql"], language="sql")
    else:
        # Validation Passed Banner
        st.markdown("""
            <div style="background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.5rem 1rem; color: #34d399; margin-bottom: 1rem; font-size: 0.9rem; display: inline-block;">
                🛡️ Safety Validation Passed (Read-Only Select & Allowed Schema)
            </div>
        """, unsafe_allow_html=True)

        # Columns layout for SQL and Data
        st.markdown(f"""
            <div class="glass-card">
                <div class="sql-header">⚡ Generated SQL Query</div>
            </div>
        """, unsafe_allow_html=True)
        st.code(result["sql"], language="sql")
        
        st.markdown("### 📊 Live Results")
        if not result["rows"]:
            st.warning("Query returned 0 rows.")
        else:
            df = pd.DataFrame(result["rows"])
            
            # Display results
            st.dataframe(df, use_container_width=True)
            
            # Export CSV Option
            csv_data = df.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Download results as CSV",
                data=csv_data,
                file_name="query_results.csv",
                mime="text/csv"
            )
