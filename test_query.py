"""
test_query.py
=============
Command-line tool to test the Text-to-SQL pipeline interactively.

Usage examples:
    python test_query.py --provider gemini
    python test_query.py --provider ollama

    # Or pass a question directly:
    python test_query.py --provider gemini --question "What is total revenue by channel?"
"""

import argparse
import json
from sql_generator import SQLGenerator

SAMPLE_QUESTIONS = [
    "What is the total revenue (line_total) by sales channel?",
    "Who are the top 5 customers by total order value?",
    "How many orders were placed each month in 2021?",
    "What is the best selling product by total quantity ordered?",
    "What is the average unit price per warehouse?",
]


def pretty_print(result: dict):
    print("\n" + "=" * 60)
    print(f"[Q] Question : {result['question']}")
    print(f"[SQL]         : {result['sql']}")
    print("=" * 60)

    if result["error"]:
        print(f"[ERROR]  : {result['error']}")
    elif not result["rows"]:
        print("[WARN] No rows returned.")
    else:
        rows = result["rows"]
        print(f"[OK] Rows : {len(rows)} result(s)\n")
        # Print as aligned table
        keys = list(rows[0].keys())
        col_widths = {k: max(len(k), max(len(str(r.get(k, ""))) for r in rows)) for k in keys}
        header = "  ".join(k.ljust(col_widths[k]) for k in keys)
        sep = "  ".join("-" * col_widths[k] for k in keys)
        print(header)
        print(sep)
        for row in rows:
            print("  ".join(str(row.get(k, "")).ljust(col_widths[k]) for k in keys))
    print()


def run_interactive(gen: SQLGenerator):
    print("\n=== QueryMind Text-to-SQL Interactive Mode ===")
    print("    Provider:", gen.provider.upper())
    print("    Type your question, 'demo' for samples, or 'exit' to quit.\n")

    while True:
        try:
            question = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break

        if not question:
            continue
        if question.lower() == "exit":
            print("Goodbye!")
            break
        if question.lower() == "demo":
            for q in SAMPLE_QUESTIONS:
                result = gen.query(q)
                pretty_print(result)
        else:
            result = gen.query(question)
            pretty_print(result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QueryMind Text-to-SQL CLI tester")
    parser.add_argument(
        "--provider",
        choices=["gemini", "ollama"],
        default="gemini",
        help="Which LLM provider to use (default: gemini)",
    )
    parser.add_argument(
        "--question",
        type=str,
        default=None,
        help="Run a single question and exit (optional)",
    )
    args = parser.parse_args()

    gen = SQLGenerator(provider=args.provider)

    if args.question:
        result = gen.query(args.question)
        pretty_print(result)
    else:
        run_interactive(gen)
