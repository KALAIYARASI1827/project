import re
from typing import Optional
from langchain_community.vectorstores import PGVector
from langchain_ollama import OllamaEmbeddings, ChatOllama


# CONFIG

CONNECTION_STRING = "postgresql+psycopg2://dbadmin:Ur12ec125@49.204.233.77:5432/mfrp_kalai"
COLLECTION_NAME = "college_rag_full"
OLLAMA_URL = "http://49.204.233.77:11434"

embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url=OLLAMA_URL)
llm = ChatOllama(model="mistral", base_url=OLLAMA_URL, temperature=0)

db = PGVector(
    connection_string=CONNECTION_STRING,
    collection_name=COLLECTION_NAME,
    embedding_function=embeddings,
)


# NORMALIZE

def norm(text: str):
    return re.sub(r"\s+", " ", text.lower().strip())


# DETECTORS
def detect_semester(q: str) -> Optional[str]:
    if "odd" in q:
        return "Odd"
    if "even" in q:
        return "Even"
    return None


def detect_batch(q: str) -> Optional[str]:
    if "first year" in q:
        return "First Year BE/BTech (Reg. & SW) & First Year ME/MTech"
    if "second year" in q:
        return "Second Year BE/BTech (Reg. & SW) & First Year MCA"
    if "third year" in q:
        return "Third Year BE/BTech (Reg. & SW), Second Year ME/MTech/MCA, All BSc & All MSc"
    if "fourth year" in q:
        return "Fourth Year BE/BTech and Fifth Year BE (SW)"
    return None


def detect_event(q: str) -> Optional[str]:
    events = [
        "ca test 1", "ca test 2", "ca test 3",
        "intermediate feedback 1", "intermediate feedback 2",
        "semester examination", "laboratory examination",
        "reopening", "last working day"
    ]
    for e in events:
        if e in q:
            return e
    return None


# EXTRACTION
def extract_start_date(text: str):
    text = text.strip()
    if "-" in text:
        return text.split("-")[0].strip()
    return text


def extract_from_block(block: str, event: str):
    for line in block.splitlines():
        if "->" in line:
            left, right = line.split("->", 1)
            if norm(left) == event:
                return extract_start_date(right)
    return None



# MAIN FUNCTION

def search_pdf(question: str):

    q = norm(question)

    batch = detect_batch(q)
    semester = detect_semester(q)
    event = detect_event(q)

    
    #  1. STRICT CALENDAR 
    
    if batch and event:

        # BOTH SEMESTERS
        if not semester:

            odd_docs = db.similarity_search(
                question, k=10,
                filter={"doc_type": "calendar", "batch": batch, "semester": "Odd"}
            )

            even_docs = db.similarity_search(
                question, k=10,
                filter={"doc_type": "calendar", "batch": batch, "semester": "Even"}
            )

            odd_date, even_date = None, None

            for d in odd_docs:
                odd_date = extract_from_block(d.page_content, event)
                if odd_date:
                    break

            for d in even_docs:
                even_date = extract_from_block(d.page_content, event)
                if even_date:
                    break

            if odd_date or even_date:
                return (
                    f"Batch: {batch}\n"
                    f"Odd Semester Start: {odd_date if odd_date else 'Not available'}\n"
                    f"Even Semester Start: {even_date if even_date else 'Not available'}"
                )

        # SINGLE SEMESTER
            else:
                docs = db.similarity_search(
                question, k=10,
                filter={"doc_type": "calendar", "batch": batch, "semester": semester}
            )

            for d in docs:   #  now inside else
                date = extract_from_block(d.page_content, event)
                if date:
                    return (
                        f"Batch: {batch}\n"
                        f"Semester: {semester}\n"
                        f"Event: {event}\n"
                        f"Start Date: {date}"
                    )
    
    #  2. HOLIDAY (SEMANTIC)

    if any(x in q for x in ["pongal", "holiday", "deepavali", "christmas", "ramzan"]):

        docs = db.similarity_search(
            question, k=10,
            filter={"doc_type": "holiday"}
        )

        if docs:
            return "\n\n".join([d.page_content for d in docs[:3]])

    
    #  3. LLM FALLBACK (CHATGPT MODE)
   
    docs = db.similarity_search(question, k=10)

    context = "\n\n".join([d.page_content for d in docs])

    prompt = f"""
You are an academic assistant.

Answer naturally like ChatGPT using the context.

Rules:
- You can list items
- You can summarize
- For month queries (e.g., January holidays), extract correctly
- Do NOT hallucinate outside context
- If not found → say "Not found in documents"

Context:
{context}

Question:       
{question}

Answer:
"""

    response = llm.invoke(prompt)
    return response.content.strip()