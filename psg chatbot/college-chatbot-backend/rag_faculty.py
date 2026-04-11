import traceback
import psycopg2
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from rapidfuzz import fuzz

from langchain_community.vectorstores import PGVector
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import PromptTemplate

# CONFIG
DB_CONFIG = {
    "host": "49.204.233.77",
    "port": "5432",
    "database": "mfrp_kalai",
    "user": "dbadmin",
    "password": "Ur12ec125"
}

COLLECTION_NAME = "documents"
OLLAMA_URL = "http://49.204.233.77:11434"

#INIT 
embedding = OllamaEmbeddings(model="nomic-embed-text", base_url=OLLAMA_URL)
llm = ChatOllama(model="mistral", base_url=OLLAMA_URL, temperature=0.1)

vectordb = PGVector(
    connection_string=f"postgresql+psycopg2://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}",
    collection_name=COLLECTION_NAME,
    embedding_function=embedding,
    use_jsonb=True
)

prompt = PromptTemplate.from_template("""
You are a PSG College assistant.
Answer ONLY from context.
Do not hallucinate.

Context:
{context}

Question:
{question}

Answer:
""")

rag_chain = prompt | llm

# HELPERS
def clean(text):
    return str(text).lower().replace("&", "and").strip()

def detect_department_id(query):
    q = clean(query)
    mapping = {
        "cse": "cse", "computer science": "cse",
        "ece": "ece", "electronics": "ece",
        "eee": "eee", "electrical": "eee",
        "mech": "mech", "mechanical": "mech",
        "civil": "civil",
        "it": "it",
        "math": "amcs", "maths": "amcs"
    }
    for k, v in mapping.items():
        if k in q:
            return v
    return None

def detect_query_type(query):
    q = clean(query)

    if "hod" in q:
        return "hod"
    elif "list" in q or "all faculty" in q:
        return "list"
    elif "who is" in q or "tell me about" in q:
        return "person"
    else:
        return "general"

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

#  PERSON (FIXED) 
def get_person_sql(query):
    q = clean(query)
    name_query = q.replace("who is", "").replace("tell me about", "").strip()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            cmetadata->>'name' AS name,
            cmetadata->>'department' AS department,
            cmetadata->>'role' AS role,
            document
        FROM langchain_pg_embedding
        WHERE LOWER(cmetadata->>'name') ILIKE %s
        LIMIT 10
    """, (f"%{name_query}%",))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        return None

    #  fuzzy ranking
    ranked = sorted(
        rows,
        key=lambda x: fuzz.partial_ratio(name_query, (x[0] or "").lower()),
        reverse=True
    )

    return ranked[:3]

# HOD 
def get_hod_sql(dept_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            cmetadata->>'name',
            cmetadata->>'department',
            cmetadata->>'role',
            document
        FROM langchain_pg_embedding
        WHERE cmetadata->>'department_id' = %s
          AND LOWER(cmetadata->>'role') = 'hod'
        LIMIT 3
    """, (dept_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return rows

#  LIST 
def get_faculty_list_sql(dept_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT cmetadata->>'name'
        FROM langchain_pg_embedding
        WHERE cmetadata->>'department_id' = %s
    """, (dept_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [r[0] for r in rows if r[0]]

#  VECTOR 
def get_general_vector(query):
    return vectordb.similarity_search(query, k=5)

# FORMAT 
def format_sql_rows(rows):
    context = []
    for name, dept, role, content in rows:
        context.append(f"{name} ({dept}) [{role}]\n{content}")
    return "\n\n---\n\n".join(context)

def format_vector_docs(docs):
    context = []
    for doc in docs:
        meta = doc.metadata
        context.append(
            f"{meta.get('name')} ({meta.get('department')})\n{doc.page_content}"
        )
    return "\n\n---\n\n".join(context)

#  MAIN 
def faculty_answer(question):
    try:
        qtype = detect_query_type(question)
        dept_id = detect_department_id(question)

        #  PERSON
        if qtype == "person":
            rows = get_person_sql(question)

            if rows:
                context = format_sql_rows(rows)
            else:
                docs = get_general_vector(question)
                if not docs:
                    return "I'm sorry, I don't have that information."
                context = format_vector_docs(docs)

        #  HOD
        elif qtype == "hod":
            if not dept_id:
                return "Please specify the department."

            rows = get_hod_sql(dept_id)

            if not rows:
                return "I'm sorry, I don't have that information."

            context = format_sql_rows(rows)

        #  LIST
        elif qtype == "list":
            if not dept_id:
                return "Please specify the department."

            faculty = get_faculty_list_sql(dept_id)

            if not faculty:
                return "I'm sorry, I don't have that information."

            return "Faculty Members:\n\n" + "\n".join(sorted(faculty))

        #  GENERAL
        else:
            docs = get_general_vector(question)

            if not docs:
                return "I'm sorry, I don't have that information."

            context = format_vector_docs(docs)

        #  LLM
        response = rag_chain.invoke({
            "context": context,
            "question": question
        })

        return response.content

    except Exception:
        return traceback.format_exc()

#  FASTAPI 
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str

