"""Site memory: what each website is and where its key elements are.

Learned the first time a site is visited (there is no hardcoded site list),
saved to .strands/sites.json, and used to:
  - route "search X" / "play X" / "ask X" straight to the site's search or
    chat box without a model call, and
  - tell the agent where it is ("YouTube — video site, search box known").

Only page structure is stored (selectors, labels, a one-line summary) — never
what the user typed or read.
"""

import difflib
import json
import os
import threading
import time
from urllib.parse import urlparse

PATH = os.path.join(os.path.dirname(__file__), ".strands", "sites.json")

_lock = threading.Lock()
_sites = None


def domain_of(url):
    """'https://www.youtube.com/watch?v=1' -> 'youtube.com'."""
    host = (urlparse(url or "").hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _load():
    global _sites
    if _sites is None:
        try:
            with open(PATH) as f:
                _sites = json.load(f)
        except (OSError, ValueError):
            _sites = {}
    return _sites


def _save():
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    tmp = PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(_sites, f, indent=2)
    os.replace(tmp, PATH)


def reset(path=None):
    """Forget the in-memory copy (tests point PATH at a temp file first)."""
    global _sites, PATH
    if path:
        PATH = path
    _sites = None


def get(domain):
    with _lock:
        return dict(_load().get(domain) or {})


def needs_learning(domain):
    entry = get(domain)
    return not entry or "type" not in entry or not (entry.get("search") or entry.get("chat"))


def remember_elements(domain, keys, title=None):
    """Store the search/chat boxes found on a page. Missing ones don't erase known ones."""
    if not domain:
        return
    with _lock:
        sites = _load()
        entry = sites.setdefault(domain, {})
        for kind in ("search", "chat"):
            found = (keys or {}).get(kind)
            if found and found.get("selector"):
                entry[kind] = {"selector": found["selector"], "label": found.get("label", "")}
        if title and "name" not in entry:
            entry["title"] = title
        entry["seen"] = int(time.time())
        _save()


def remember_profile(domain, profile):
    """Store the model's one-time description: name, type, summary, what to do after searching."""
    if not domain or not profile:
        return
    with _lock:
        sites = _load()
        entry = sites.setdefault(domain, {})
        for key in ("name", "type", "summary", "after_search"):
            if profile.get(key):
                entry[key] = str(profile[key])[:200]
        _save()


def forget_element(domain, kind):
    """A remembered element stopped working (site redesign) — drop it so it's relearned."""
    with _lock:
        entry = _load().get(domain)
        if entry and entry.pop(kind, None) is not None:
            _save()


def find_by_name(word):
    """Domain for a site the user named ("youtube", "chat gpt"), from memory only."""
    key = "".join((word or "").lower().split())
    if not key:
        return None
    with _lock:
        for domain, entry in _load().items():
            name = "".join((entry.get("name") or "").lower().split())
            if key == name or key == domain or domain.split(".")[0] == key:
                return domain
    return None


def find_similar(word, cutoff=0.7):
    """Domain whose remembered name sounds close to `word` — fixes voice mishearings
    like "chad gpt" -> ChatGPT or "cloud" -> Claude, but only for sites already learned."""
    key = "".join((word or "").lower().split())
    if not key:
        return None
    exact = find_by_name(word)
    if exact:
        return exact
    with _lock:
        candidates = {}
        for domain, entry in _load().items():
            for name in ("".join((entry.get("name") or "").lower().split()), domain.split(".")[0]):
                if name:
                    candidates[name] = domain
    match = difflib.get_close_matches(key, list(candidates), n=1, cutoff=cutoff)
    return candidates[match[0]] if match else None


def forget_site(domain):
    """Drop everything learned about a site (e.g. a broken page learned by mistake)."""
    with _lock:
        if _load().pop(domain, None) is not None:
            _save()


def guess_domain(word):
    """Best guess for a site we've never seen: a domain as given, else word.com."""
    word = (word or "").strip().lower()
    if "." in word and " " not in word:
        return domain_of("https://" + word) or word
    return "".join(word.split()) + ".com"


def describe(domain):
    """One line for the agent's prompt about the current site, or '' if unknown."""
    entry = get(domain)
    if not entry:
        return ""
    name = entry.get("name") or entry.get("title") or domain
    parts = [f"{name} ({domain})"]
    if entry.get("type"):
        parts.append(entry["type"])
    if entry.get("summary"):
        parts.append(entry["summary"])
    known = []
    if entry.get("search"):
        known.append('search box known — use act("search", 0, "query")')
    if entry.get("chat"):
        known.append('chat box known — use act("ask", 0, "message")')
    if entry.get("after_search") == "read_text":
        known.append("after searching, use read_text to get the answer")
    elif entry.get("after_search") == "open_result":
        known.append("after searching, open the best result")
    return " — ".join(parts) + (". " + "; ".join(known) if known else "")
