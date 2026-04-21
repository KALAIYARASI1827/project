import tomllib
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from ollama import Client

from rag_pdf import search_pdf
from rag_faculty import faculty_answer
from web_scrapper import search_events_live

import warnings
# Suppress LangChain deprecation noise
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", message=".*PendingDeprecationWarning.*")
warnings.filterwarnings("ignore", message=".*LangChainPendingDeprecationWarning.*")


with open(Path(__file__).parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

app = Flask(__name__)
CORS(app)

client = Client(host=_cfg["ollama"]["url"], timeout=15)
_model = _cfg["ollama"]["chat_model"]
_server = _cfg["server"]
_auth = _cfg["auth"]
_sessions: set[str] = set()

# DATABASE

def _db_conn():
    db = _cfg["database"]
    return psycopg2.connect(
        host=db["host"], port=int(db["port"]),
        dbname=db["name"], user=db["user"], password=db["password"]
    )

def _init_db():
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS chat_conversations (
                        id       SERIAL PRIMARY KEY,
                        title    VARCHAR(255) NOT NULL DEFAULT 'New Chat',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS chat_messages (
                        id              SERIAL PRIMARY KEY,
                        conversation_id INTEGER NOT NULL
                            REFERENCES chat_conversations(id) ON DELETE CASCADE,
                        role    VARCHAR(10) NOT NULL,
                        content TEXT       NOT NULL,
                        route   VARCHAR(20),
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
    finally:
        conn.close()

_init_db()

# ROUTER
def route(question: str) -> str:
    res = client.chat(
        model=_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Classify the user question into exactly one category.\n"
                    "Categories:\n"
                    "  FACULTY  - questions about a specific teacher, professor, HOD, staff member, or any person at the college\n"
                    "  PDF      - questions about exam dates, CA tests, semester schedule, holidays, attendance, feedback forms, academic calendar, reopening dates\n"
                    "  EVENT    - questions about upcoming events, announcements, competitions, or college activities\n"
                    "  GENERAL  - anything else not covered above\n"
                    "Reply with only the category name. No explanation."
                )
            },
            {"role": "user", "content": question}
        ],
        options={"temperature": 0}
    )
    label = res["message"]["content"].strip().upper()
    result = label if label in {"FACULTY", "PDF", "EVENT"} else "GENERAL"
    print(f" LLM routed → {result} (raw: '{res['message']['content'].strip()}')")
    return result



# FAILURE CHECK

def is_failed(ans: str):
    if not ans:
        return True

    ans = ans.lower()
    return any(x in ans for x in [
        "not found", "not available",
        "no data", "no matching",
        "there is no", "no such",
        "not in the provided", "not in the context",
        "no information", "cannot find",
        "i don't have", "i do not have",
        "i'm sorry, i don't", "i'm sorry, i do not",
        "no character", "no person",
    ])


# GENERAL LLM

def general_llm(question: str, history: list = None):
    print(f"  [LLM general] question: '{question[:60]}' | history_len: {len(history or [])}")
    messages = [
        {"role": "system", "content": "You are a helpful and intelligent assistant for PSG Tech college. Answer clearly and accurately."}
    ]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": question})
    res = client.chat(model=_model, messages=messages, options={"temperature": 0.5})
    print(f"  [LLM general] response: '{res['message']['content'][:60]}'")
    return res["message"]["content"]



# AUTH ENDPOINTS

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = (data or {}).get("username", "")
    password = (data or {}).get("password", "")
    if username == _auth["username"] and password == _auth["password"]:
        token = secrets.token_hex(32)
        _sessions.add(token)
        return jsonify({"token": token})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    _sessions.discard(token)
    return jsonify({"success": True})


# HEALTH CHECK

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})



# CONVERSATION ENDPOINTS

@app.route("/conversations", methods=["GET"])
def list_conversations():
    conn = _db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, title FROM chat_conversations ORDER BY updated_at DESC")
            rows = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
    return jsonify(rows)


@app.route("/conversations", methods=["POST"])
def create_conversation():
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("INSERT INTO chat_conversations DEFAULT VALUES RETURNING id, title")
                row = dict(cur.fetchone())
    finally:
        conn.close()
    return jsonify(row), 201


@app.route("/conversations/<int:cid>", methods=["PATCH"])
def rename_conversation(cid):
    data  = request.get_json()
    title = (data or {}).get("title", "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE chat_conversations SET title=%s, updated_at=NOW() WHERE id=%s",
                    (title, cid)
                )
    finally:
        conn.close()
    return jsonify({"success": True})


@app.route("/conversations/<int:cid>", methods=["DELETE"])
def delete_conversation(cid):
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM chat_conversations WHERE id=%s", (cid,))
    finally:
        conn.close()
    return jsonify({"success": True})


@app.route("/conversations/<int:cid>/messages", methods=["GET"])
def get_conversation_messages(cid):
    conn = _db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT role, content, route FROM chat_messages "
                "WHERE conversation_id=%s ORDER BY created_at",
                (cid,)
            )
            rows = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
    return jsonify(rows)


# CHAT ENDPOINT (REST)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()

    if not data or "message" not in data:
        return jsonify({"error": "message is required"}), 400

    question = data["message"].strip()
    history  = data.get("history") or []

    print(f"\n {question}")

    try:
        route_type = route(question)
        print(" Route:", route_type)
        # -------------------------
        # FACULTY
        # -------------------------
        if route_type == "FACULTY":
            ans = faculty_answer(question)
            if is_failed(ans):
                ans = general_llm(question, history)

        # -------------------------
        # PDF
        # -------------------------
        elif route_type == "PDF":
            ans = search_pdf(question)
            if is_failed(ans):
                ans = general_llm(question, history)

        # -------------------------
        # EVENTS
        # -------------------------
        elif route_type == "EVENT":
            ans = search_events_live(question)
            if is_failed(ans):
                ans = general_llm(question, history)

        # -------------------------
        # GENERAL
        # -------------------------
        else:
            ans = general_llm(question, history)

        conversation_id = data.get("conversation_id")
        if conversation_id:
            try:
                conn = _db_conn()
                try:
                    with conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "INSERT INTO chat_messages (conversation_id, role, content) VALUES (%s, 'user', %s)",
                                (conversation_id, question)
                            )
                            cur.execute(
                                "INSERT INTO chat_messages (conversation_id, role, content, route) VALUES (%s, 'bot', %s, %s)",
                                (conversation_id, ans, route_type)
                            )
                            cur.execute(
                                """UPDATE chat_conversations
                                   SET updated_at = NOW(),
                                       title = CASE WHEN title = 'New Chat' THEN %s ELSE title END
                                   WHERE id = %s""",
                                (question[:40], conversation_id)
                            )
                finally:
                    conn.close()
            except Exception as db_err:
                print(" DB save error:", db_err)

        return jsonify({
            "answer": ans,
            "route": route_type
        })

    except ConnectionError as e:
        print(" CONNECTION ERROR:", e)
        return jsonify({"error": "AI service is currently unavailable. Please try again later."}), 503
    except TimeoutError as e:
        print(" TIMEOUT:", e)
        return jsonify({"error": "Request timed out. The AI service may be overloaded."}), 504
    except Exception as e:
        print(" ERROR:", type(e).__name__, e)
        msg = str(e)
        if "Connection timed out" in msg or "Connection refused" in msg or "timed out" in msg.lower():
            return jsonify({"error": "AI service is currently unavailable. Please try again later."}), 503
        return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host=_server["host"], port=_server["port"], debug=_server["debug"])