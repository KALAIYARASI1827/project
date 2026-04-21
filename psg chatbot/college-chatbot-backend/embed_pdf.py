import tomllib
import fitz
from pathlib import Path
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import PGVector

# CONFIG
with open(Path(__file__).parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)

_db = _cfg["database"]
CONNECTION_STRING = (
    f"postgresql+psycopg2://{_db['user']}:{_db['password']}"
    f"@{_db['host']}:{_db['port']}/{_db['name']}"
)
COLLECTION_NAME = _cfg["vectorstore"]["embed_collection"]
OLLAMA_URL = _cfg["ollama"]["url"]

PDF_PATH = Path(__file__).parent / _cfg["embed"]["pdf_path"]


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