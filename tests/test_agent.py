"""Tests for agent command parsing and routing (no AWS/Bedrock needed)."""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from agent import try_direct, classify


class TestTryDirect:
    def test_click(self):
        assert try_direct("click 5") == ("click", 5, None)

    def test_click_case_insensitive(self):
        assert try_direct("Click 12") == ("click", 12, None)

    def test_click_with_whitespace(self):
        assert try_direct("  click 3  ") == ("click", 3, None)

    def test_type(self):
        assert try_direct("type 12 hello world") == ("type", 12, "hello world")

    def test_select(self):
        assert try_direct("select 5 Missouri") == ("select", 5, "Missouri")

    def test_scroll_down(self):
        assert try_direct("scroll down") == ("scroll", None, "down")

    def test_scroll_up(self):
        assert try_direct("scroll up") == ("scroll", None, "up")

    def test_scroll_bare(self):
        assert try_direct("scroll") == ("scroll", None, "down")

    def test_back(self):
        assert try_direct("back") == ("back", None, None)

    def test_open(self):
        assert try_direct("open weather.gov") == ("open", None, "weather.gov")

    def test_list(self):
        assert try_direct("list") == ("list", None, None)

    def test_not_direct(self):
        assert try_direct("search for weather") is None

    def test_not_direct_sentence(self):
        assert try_direct("click the search button") is None

    def test_click_no_number(self):
        assert try_direct("click") is None

    def test_type_no_value(self):
        assert try_direct("type 5") is None

    def test_empty(self):
        assert try_direct("") is None

    def test_new_tab_bare(self):
        assert try_direct("new tab") == ("new_tab", None, "https://google.com")

    def test_new_tab_shortcut(self):
        assert try_direct("new tab youtube") == ("new_tab", None, "https://youtube.com")

    def test_new_tab_twitter(self):
        assert try_direct("new tab twitter") == ("new_tab", None, "https://x.com")

    def test_new_tab_url(self):
        assert try_direct("new tab weather.gov") == ("new_tab", None, "https://weather.gov")

    def test_new_tab_full_url(self):
        assert try_direct("new tab https://example.com") == ("new_tab", None, "https://example.com")

    def test_new_tab_unknown_word(self):
        assert try_direct("new tab something random") is None

    def test_new_tab_case_insensitive(self):
        assert try_direct("New Tab YouTube") == ("new_tab", None, "https://youtube.com")


class TestClassify:
    def test_direct_click(self):
        assert classify("click 5") == "direct"

    def test_direct_scroll(self):
        assert classify("scroll down") == "direct"

    def test_direct_list(self):
        assert classify("list") == "direct"

    def test_haiku_simple_verb(self):
        assert classify("click the search button") == "haiku"

    def test_haiku_type_command(self):
        assert classify("type my name in the box") == "haiku"

    def test_haiku_short(self):
        assert classify("go back") == "haiku"

    def test_haiku_open(self):
        assert classify("open the weather website") == "haiku"

    def test_sonnet_complex(self):
        assert classify("search for weather in Kansas City and tell me the forecast") == "sonnet"

    def test_sonnet_multi_step(self):
        assert classify("fill out the benefits form with my information and submit it") == "sonnet"

    def test_sonnet_form(self):
        assert classify("I need to check what disability benefits I might qualify for") == "sonnet"

    def test_sonnet_and_keyword(self):
        assert classify("open usa.gov and check what disability I qualify for") == "sonnet"

    def test_sonnet_question_mark(self):
        assert classify("what disability benefits do I qualify for?") == "sonnet"

    def test_haiku_still_works(self):
        assert classify("click the search button") == "haiku"

    def test_sonnet_fill_form(self):
        assert classify("fill out my disability benefits application") == "sonnet"


class TestUserDetailsFile:
    def test_seed_file_exists(self):
        path = os.path.join(os.path.dirname(__file__), "..", "backend", "user_details.json")
        assert os.path.exists(path)

    def test_seed_file_has_required_fields(self):
        path = os.path.join(os.path.dirname(__file__), "..", "backend", "user_details.json")
        with open(path) as f:
            details = json.load(f)
        required = [
            "first_name", "last_name", "date_of_birth", "email", "phone",
            "address", "city", "state", "zip", "disability_type",
        ]
        for field in required:
            assert field in details, f"Missing field: {field}"

    def test_seed_file_values(self):
        path = os.path.join(os.path.dirname(__file__), "..", "backend", "user_details.json")
        with open(path) as f:
            details = json.load(f)
        assert details["first_name"] == "Jordan"
        assert details["last_name"] == "Rivera"


class TestSearchShortcuts:
    """Searches on known sites open the results URL directly — no model call."""

    def setup_method(self):
        import server
        self.server = server
        server.last_page = None

    def test_search_on_youtube(self):
        assert try_direct("search cat videos on youtube") == (
            "open", None, "https://www.youtube.com/results?search_query=cat+videos")

    def test_search_for_on_google(self):
        assert try_direct("search for weather in Kansas City on Google") == (
            "open", None, "https://www.google.com/search?q=weather+in+Kansas+City")

    def test_play_on_youtube(self):
        assert try_direct("play dark souls 3 on youtube")[2].endswith("search_query=dark+souls+3")

    def test_search_site_for(self):
        assert try_direct("search amazon for wheelchair cushion") == (
            "open", None, "https://www.amazon.com/s?k=wheelchair+cushion")

    def test_ask_chatgpt(self):
        assert try_direct("ask ChatGPT what is the biggest animal?") == (
            "open", None, "https://chatgpt.com/?q=what+is+the+biggest+animal%3F")

    def test_ask_chat_gpt_two_words(self):
        assert try_direct("ask chat gpt to write a poem")[2] == "https://chatgpt.com/?q=write+a+poem"

    def test_trailing_period_from_voice(self):
        assert try_direct("search cats on youtube.")[2].endswith("search_query=cats")

    def test_bare_search_uses_current_site(self):
        self.server.last_page = {"url": "https://www.youtube.com/watch?v=abc"}
        assert try_direct("search for dark souls 3")[2] == (
            "https://www.youtube.com/results?search_query=dark+souls+3")

    def test_bare_search_on_unknown_site_goes_to_agent(self):
        self.server.last_page = {"url": "https://www.weather.gov/"}
        assert try_direct("search for weather in Kansas City") is None
        assert classify("search for weather in Kansas City") == "sonnet"

    def test_bare_search_no_page_goes_to_agent(self):
        assert try_direct("search for weather in Kansas City") is None

    def test_find_on_this_page_not_a_shortcut(self):
        assert try_direct("find the login button on this page") is None

    def test_search_shortcut_classified_direct(self):
        assert classify("search cat videos on youtube") == "direct"


class TestFormatPage:
    def test_includes_headings_errors_and_question_labels(self):
        from agent import _format_page
        out = _format_page({
            "title": "Questionnaire",
            "count": 2,
            "context": {"headings": ["Are you married?"], "errors": ["Select an answer."]},
            "elements": [
                {"num": 4, "type": "radio", "label": "Are you married? → No", "value": " [unchecked]"},
                {"num": 9, "type": "button", "label": "Next", "value": ""},
            ],
        })
        assert "Headings: Are you married?" in out
        assert "ERRORS ON PAGE: Select an answer." in out
        assert "4: [radio] Are you married? → No =  [unchecked]" in out

    def test_no_context_is_fine(self):
        from agent import _format_page
        out = _format_page({"title": "T", "count": 0, "elements": []})
        assert "Headings" not in out and "ERRORS" not in out


class TestSeededDetails:
    def test_ssa_answers_seeded_and_marital_status_left_out(self, tmp_path):
        import asyncio
        from memory_store import LocalMemoryStore
        store = LocalMemoryStore(str(tmp_path))
        asyncio.run(store.initialize())
        keys = asyncio.run(store._storage.list())
        assert "worked_and_paid_social_security_taxes" in keys
        assert "permanent_kidney_failure" in keys
        assert not any("married" in k or "marital" in k for k in keys)
        text = asyncio.run(store._storage.read("permanent_kidney_failure")).decode()
        assert text == "The user does not have permanent kidney failure"
