import os
import fitz
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import PGVector

# CONFIG
CONNECTION_STRING = "postgresql+psycopg2://dbadmin:Ur12ec125@49.204.233.77:5432/mfrp_kalai"
COLLECTION_NAME = "college_rag_final"
OLLAMA_URL = "http://49.204.233.77:11434"

PDF_PATH = "D:\\psg chatbot\\college-chatbot-backend\\pdfs\\finalcalendar.pdf"


def load_pdf(path):
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text


def split_docs(text):
    sections = text.split("Activity Date")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=900,
        chunk_overlap=150
    )

    docs = []

    for sec in sections:
        sec_lower = sec.lower()

        if "assessment" not in sec_lower:
            continue

        chunks = splitter.split_text(sec)

        for chunk in chunks:
            chunk_lower = chunk.lower()

            #  EXTRACT METADATA
            year = None
            if "1st yr" in chunk_lower:
                year = "1"
            elif "2nd yr" in chunk_lower:
                year = "2"
            elif "3rd yr" in chunk_lower:
                year = "3"
            elif "4th yr" in chunk_lower:
                year = "4"

            docs.append(
                Document(
                    page_content=chunk,
                    metadata={
                        "year": year,
                        "text": chunk_lower
                    }
                )
            )

    return docs


def ingest():
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=OLLAMA_URL
    )

    text = load_pdf(PDF_PATH)
    docs = split_docs(text)

    print("Chunks:", len(docs))

    PGVector.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING,
        pre_delete_collection=True
    )

    print("DONE")


if __name__ == "__main__":
    ingest()