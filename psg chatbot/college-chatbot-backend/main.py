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


app = Flask(__name__)
CORS(app)

client = Client(host="http://49.204.233.77:11434")

# ROUTER
def route(question: str):
    q = question.lower()

    if any(x in q for x in ["faculty", "hod", "staff", "professor"]):
        return "FACULTY"

    if any(x in q for x in [
        "ca test", "semester", "exam", "reopening",
        "feedback", "attendance", "holiday",
        "pongal", "deepavali", "laboratory",
        "calendar"
    ]):
        return "PDF"

    if any(x in q for x in ["event", "announcement", "upcoming"]):
        return "EVENT"

    return "GENERAL"



# FAILURE CHECK

def is_failed(ans: str):
    if not ans:
        return True

    ans = ans.lower()
    return any(x in ans for x in [
        "not found", "not available",
        "no data", "no matching"
    ])


# GENERAL LLM

def general_llm(question: str):
    res = client.chat(
        model="mistral",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful and intelligent assistant. Answer clearly and accurately."
            },
            {"role": "user", "content": question}
        ],
        options={"temperature": 0.5}
    )
    return res["message"]["content"]



# HEALTH CHECK

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})



# CHAT ENDPOINT (REST)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()

    if not data or "message" not in data:
        return jsonify({"error": "message is required"}), 400

    question = data["message"].strip()

    print(f"\n {question}")

    route_type = route(question)
    print(" Route:", route_type)

    try:
        # -------------------------
        # FACULTY
        # -------------------------
        if route_type == "FACULTY":
            ans = faculty_answer(question)
            if is_failed(ans):
                ans = general_llm(question)

        # -------------------------
        # PDF
        # -------------------------
        elif route_type == "PDF":
            ans = search_pdf(question)
            if is_failed(ans):
                ans = general_llm(question)

        # -------------------------
        # EVENTS
        # -------------------------
        elif route_type == "EVENT":
            ans = search_events_live(question)
            if is_failed(ans):
                ans = general_llm(question)

        # -------------------------
        # GENERAL
        # -------------------------
        else:
            ans = general_llm(question)

        return jsonify({
            "answer": ans,
            "route": route_type
        })

    except Exception as e:
        print(" ERROR:", e)
        return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)