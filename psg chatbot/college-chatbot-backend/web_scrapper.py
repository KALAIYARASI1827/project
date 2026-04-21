import tomllib
import requests
from pathlib import Path
from bs4 import BeautifulSoup
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

with open(Path(__file__).parent / "config.toml", "rb") as f:
    _cfg = tomllib.load(f)["scraper"]

#DISABLE WARNINGS
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


#TLS FIX 
class TLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = create_urllib3_context()
        context.set_ciphers("DEFAULT:@SECLEVEL=1")
        context.check_hostname = False
        kwargs["ssl_context"] = context
        return super().init_poolmanager(*args, **kwargs)


# SCRAPER
def scrape_events_live():
    url = _cfg["url"]

    try:
        session = requests.Session()
        session.mount("https://", TLSAdapter())

        headers = {"User-Agent": _cfg["user_agent"]}
        res = session.get(url, headers=headers, timeout=_cfg["timeout"], verify=False)

        soup = BeautifulSoup(res.text, "html.parser")

        results = []

        # STEP 1: Find "Announcements" section
        announcements_section = None

        for h in soup.find_all(["h2", "h3", "h4"]):
            if "announcement" in h.get_text(strip=True).lower():
                announcements_section = h.find_next()
                break

        if not announcements_section:
            return []

        # STEP 2: Extract links under announcements
        for a in announcements_section.find_all("a"):
            text = a.get_text(strip=True)

            if not text:
                continue

            # strict filter
            if any(keyword in text.lower() for keyword in [
                "conference",
                "hackathon",
                "summit",
                "event",
                "conclave",
                "technology"
            ]):
                results.append(text)

        # STEP 3: Remove duplicates
        results = list(dict.fromkeys(results))

        return results[:_cfg["max_events"]]

    except Exception as e:
        print(" Scraping error:", e)
        return []


# FORMAT OUTPUT
def format_events(events):
    if not events:
        return " Unable to fetch events right now."

    formatted = "\n\n".join([
        f"{i+1}. {event}" for i, event in enumerate(events)
    ])

    return f" Upcoming Events:\n\n{formatted}"


#  MAIN FUNCTION 
def search_events_live(question: str):
    events = scrape_events_live()
    return format_events(events)