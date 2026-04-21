import traceback
import tomllib
import psycopg2
import psycopg2.extras
from pathlib import Path

from ollama import Client as OllamaClient
from rapidfuzz import fuzz

from langchain_ollama import OllamaEmbeddings, ChatOllama

# CONFIG
with open(Path(__file__).parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

_db = _cfg["database"]
DB_CONFIG = {
    "host": _db["host"],
    "port": str(_db["port"]),
    "database": _db["name"],
    "user": _db["user"],
    "password": _db["password"],
}

COLLECTION_NAME = _cfg["vectorstore"]["faculty_collection"]
OLLAMA_URL      = _cfg["ollama"]["url"]
_CHAT_MODEL     = _cfg["ollama"]["chat_model"]

_ollama = OllamaClient(host=OLLAMA_URL, timeout=10)

def _llm_classify(prompt: str) -> str:
    print(f"  [LLM classify] prompt: {prompt[:80]}...")
    res = _ollama.chat(
        model=_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0}
    )
    result = res["message"]["content"].strip().lower()
    print(f"  [LLM classify] response: '{result}'")
    return result

_llm      = None
_embedder = None

def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(model=_CHAT_MODEL, base_url=OLLAMA_URL, temperature=0.1)
    return _llm

def _get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = OllamaEmbeddings(model=_cfg["ollama"]["embed_model"], base_url=OLLAMA_URL)
    return _embedder

def _embed(text: str):
    return _get_embedder().embed_query(text)

# HELPERS
def get_connection():
    return psycopg2.connect(**DB_CONFIG)

# dept_codes matching faculty_profiles.dept_code
_DEPT_CODES = {
    "CSE", "ECE", "EEE", "MEC", "CIV", "IT", "AMC",
    "AUT", "BIO", "BME", "ICE", "MCA", "MAT", "FAT",
    "AFD", "CHE", "PHY", "ENG", "PRO", "MTL", "TXT", "RAE", "HUM", "AS"
}

def detect_department_id(query):
    result = _llm_classify(
        f"Extract the department code from the query. Return ONLY one code:\n"
        f"CSE=Computer Science, ECE=Electronics & Communication, EEE=Electrical & Electronics,\n"
        f"MEC=Mechanical, CIV=Civil, IT=Information Technology, AMC=Applied Mathematics & Computational Sciences,\n"
        f"AUT=Automobile, BIO=Biotechnology, BME=Biomedical, ICE=Instrumentation,\n"
        f"MCA=Computer Applications, MAT=Mathematics, PHY=Physics, CHE=Chemistry\n"
        f"Return null if no department is mentioned.\n\n"
        f"Examples:\n"
        f"'Who is the CSE HOD?' → CSE\n"
        f"'List ECE faculty' → ECE\n"
        f"'Mechanical department staff' → MEC\n"
        f"'Who is Helda Princy?' → null\n\n"
        f"Query: {query}\nAnswer:"
    )
    for word in result.upper().split():
        if word in _DEPT_CODES:
            return word
    return None

def detect_query_type(query):
    valid = {"hod", "list", "person", "general"}
    result = _llm_classify(
        f"Classify the query into ONE word: hod, list, person, or general\n\n"
        f"hod    = asking about the head of a department\n"
        f"list   = asking to list all faculty in a department\n"
        f"person = asking about a specific named person\n"
        f"general = any other faculty question\n\n"
        f"Examples:\n"
        f"'Who is the ECE HOD?' → hod\n"
        f"'List all CSE faculty' → list\n"
        f"'Who is Helda Princy?' → person\n"
        f"'Tell me about the professors' → general\n\n"
        f"Query: {query}\nAnswer:"
    )
    for word in result.split():
        if word in valid:
            return word
    return "general"

# FACULTY_PROFILES QUERIES

def get_person_profiles(name: str):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    sql = cur.mogrify("""
        SELECT name, department, dept_code, academic_title,
               contact_email, is_hod, in_brief,
               educational_qualifications, subject_expertise, research_areas
        FROM faculty_profiles
        WHERE LOWER(name) ILIKE %s
        LIMIT 10
    """, (f"%{name}%",)).decode()
    print(f"  [SQL person]\n{sql}")
    cur.execute(sql)
    rows = cur.fetchall()
    print(f"  [SQL person] rows returned: {len(rows)}")
    cur.close()
    conn.close()
    if not rows:
        return None
    ranked = sorted(
        rows,
        key=lambda r: fuzz.partial_ratio(name.lower(), (r["name"] or "").lower()),
        reverse=True
    )
    best_score = fuzz.partial_ratio(name.lower(), (ranked[0]["name"] or "").lower())
    print(f"  [SQL person] best match='{ranked[0]['name']}' score={best_score}")
    return ranked[:3] if best_score >= 50 else None

def get_hod_profiles(dept_code: str):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    sql = cur.mogrify("""
        SELECT name, department, dept_code, academic_title,
               contact_email, in_brief,
               educational_qualifications, subject_expertise, research_areas
        FROM faculty_profiles
        WHERE dept_code = %s AND is_hod = true
        LIMIT 3
    """, (dept_code,)).decode()
    print(f"  [SQL hod]\n{sql}")
    cur.execute(sql)
    rows = cur.fetchall()
    print(f"  [SQL hod] rows returned: {len(rows)}")
    cur.close()
    conn.close()
    return rows

def get_list_profiles(dept_code: str):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    sql = cur.mogrify("""
        SELECT name, academic_title
        FROM faculty_profiles
        WHERE dept_code = %s
        ORDER BY name
    """, (dept_code,)).decode()
    print(f"  [SQL list]\n{sql}")
    cur.execute(sql)
    rows = cur.fetchall()
    print(f"  [SQL list] rows returned: {len(rows)}")
    cur.close()
    conn.close()
    return rows

#  VECTOR — queries public.documents with nomic-embed-text (768-dim)
def get_general_vector(query, source_type=None):
    print(f"  [Vector general] query='{query[:60]}'")
    vec = _embed(query)
    vec_str = "[" + ",".join(str(v) for v in vec) + "]"

    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if source_type:
        sql = cur.mogrify("""
            SELECT title, content, metadata,
                   ROUND((1 - (embedding <=> %s::vector))::numeric, 3) AS similarity
            FROM public.documents
            WHERE embedding IS NOT NULL AND source_type = %s
            ORDER BY embedding <=> %s::vector
            LIMIT 5
        """, (vec_str, source_type, vec_str)).decode()
    else:
        sql = cur.mogrify("""
            SELECT title, content, metadata,
                   ROUND((1 - (embedding <=> %s::vector))::numeric, 3) AS similarity
            FROM public.documents
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT 5
        """, (vec_str, vec_str)).decode()

    print(f"  [SQL vector]\n{sql[:300]}...")
    cur.execute(sql)
    rows = cur.fetchall()
    if rows:
        print(f"  [Vector general] {len(rows)} docs, top similarity={rows[0]['similarity']}")
    cur.close()
    conn.close()
    return rows

# FORMAT
import json as _json

def format_profile(row):
    parts = [
        f"Name: {row['name']}",
        f"Department: {row['department']}",
        f"Title: {row['academic_title']}",
    ]
    if row.get("in_brief"):
        parts.append(f"About: {row['in_brief']}")
    for field, label in [
        ("educational_qualifications", "Education"),
        ("subject_expertise", "Expertise"),
        ("research_areas", "Research Areas"),
    ]:
        val = row.get(field)
        if isinstance(val, str):
            try:
                val = _json.loads(val)
            except Exception:
                val = None
        if val:
            parts.append(f"{label}: {', '.join(val)}")
    if row.get("contact_email"):
        parts.append(f"Email: {row['contact_email']}")
    return "\n".join(parts)

def format_vector_docs(rows):
    parts = []
    for row in rows:
        meta = row.get("metadata") or {}
        name = meta.get("name", "")
        dept = meta.get("department", "")
        header = f"{name} ({dept})" if name else row.get("title", "")
        parts.append(f"{header}\n{row['content']}")
    return "\n\n---\n\n".join(parts)

#  MAIN
def faculty_answer(question):
    try:
        qtype = detect_query_type(question)
        dept_code = detect_department_id(question)

        #  PERSON
        if qtype == "person":
            name_query = _llm_classify(
                f"Extract only the person's name from this query. Return just the name.\nQuery: {question}"
            )
            rows = get_person_profiles(name_query)
            if not rows:
                return f"I don't have any information about '{name_query}' in our faculty records."
            context = "\n\n---\n\n".join(format_profile(r) for r in rows)

        #  HOD
        elif qtype == "hod":
            if not dept_code:
                return "Please specify the department."
            rows = get_hod_profiles(dept_code)
            if not rows:
                return "I'm sorry, I don't have HOD information for that department."
            context = "\n\n---\n\n".join(format_profile(r) for r in rows)

        #  LIST
        elif qtype == "list":
            if not dept_code:
                return "Please specify the department."
            rows = get_list_profiles(dept_code)
            if not rows:
                return "I'm sorry, I don't have faculty information for that department."
            lines = [f"{r['name']} ({r['academic_title']})" for r in rows]
            return f"Faculty Members ({rows[0]['department'] if rows else dept_code}):\n\n" + "\n".join(lines)

        #  GENERAL
        else:
            docs = get_general_vector(question)
            if not docs:
                return "I'm sorry, I don't have that information."
            context = format_vector_docs(docs)

        #  LLM
        prompt = f"""You are a PSG College assistant. Answer ONLY from the context below. Do not hallucinate.

Context:
{context}

Question: {question}

Answer:"""
        print(f"  [LLM rag_faculty] invoking for: '{question[:60]}'")
        response = _get_llm().invoke(prompt)
        return response.content

    except Exception:
        print(f"  [faculty_answer] error:\n{traceback.format_exc()}")
        return "Sorry, I ran into a problem while looking that up. Please try again."
