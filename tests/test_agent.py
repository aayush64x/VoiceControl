"""Tests for agent command parsing and routing (no AWS/Bedrock needed)."""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from agent import try_direct, classify, parse_site_command


@pytest.fixture(autouse=True)
def isolated_site_memory(tmp_path):
    """Never read or write the real learned-sites file during tests."""
    import site_memory
    site_memory.reset(str(tmp_path / "sites.json"))
    yield
    site_memory.reset(site_memory.PATH)


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



    def test_new_tab_url(self):
        assert try_direct("new tab weather.gov") == ("new_tab", None, "https://weather.gov")

    def test_new_tab_full_url(self):
        assert try_direct("new tab https://example.com") == ("new_tab", None, "https://example.com")




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


class TestParseSiteCommand:
    """"search / play / ask X" commands — what to do, not which site's URL."""

    def test_search_on_named_site(self):
        assert parse_site_command("search cat videos on youtube") == {
            "action": "search", "site": "youtube", "query": "cat videos", "verb": "search"}

    def test_play_on_named_site(self):
        cmd = parse_site_command("play dark souls 3 on YouTube.")
        assert cmd["verb"] == "play" and cmd["query"] == "dark souls 3" and cmd["site"] == "YouTube"

    def test_search_site_for(self):
        assert parse_site_command("search etsy for wooden ramps") == {
            "action": "search", "site": "etsy", "query": "wooden ramps", "verb": "search"}

    def test_bare_search_has_no_site(self):
        assert parse_site_command("search for weather in Kansas City") == {
            "action": "search", "site": None, "query": "weather in Kansas City", "verb": "search"}

    def test_ask_named_assistant(self):
        assert parse_site_command("ask ChatGPT what is the biggest animal?") == {
            "action": "ask", "site": "ChatGPT", "query": "what is the biggest animal?", "verb": "ask"}

    def test_ask_chat_gpt_two_words(self):
        assert parse_site_command("ask chat gpt to write a poem")["query"] == "write a poem"

    def test_bare_ask(self):
        assert parse_site_command("ask what time is sunset")["action"] == "ask"

    def test_not_site_commands(self):
        for text in ["find the login button on this page", "play it", "play the first video",
                     "click the search button", "scroll down", "weather in Kansas City"]:
            assert parse_site_command(text) is None, text


@pytest.fixture
def sites(tmp_path):
    import site_memory
    site_memory.reset(str(tmp_path / "sites.json"))
    yield site_memory
    site_memory.reset()


class TestSiteMemory:
    def test_domain_of(self, sites):
        assert sites.domain_of("https://www.youtube.com/watch?v=1") == "youtube.com"
        assert sites.domain_of("https://forecast.weather.gov/x") == "forecast.weather.gov"
        assert sites.domain_of(None) == ""

    def test_remember_and_persist(self, sites):
        sites.remember_elements("youtube.com", {"search": {"selector": "input[name=\"search_query\"]", "label": "Search"}})
        sites.remember_profile("youtube.com", {"name": "YouTube", "type": "video", "summary": "Watch videos",
                                               "after_search": "open_result"})
        sites.reset()  # reload from disk
        entry = sites.get("youtube.com")
        assert entry["search"]["selector"] == 'input[name="search_query"]'
        assert entry["type"] == "video"
        assert not sites.needs_learning("youtube.com")

    def test_missing_element_does_not_erase_known(self, sites):
        sites.remember_elements("a.com", {"search": {"selector": "#q", "label": "Search"}})
        sites.remember_elements("a.com", {"search": None, "chat": None})
        assert sites.get("a.com")["search"]["selector"] == "#q"

    def test_forget_element(self, sites):
        sites.remember_elements("a.com", {"search": {"selector": "#q", "label": "Search"}})
        sites.forget_element("a.com", "search")
        assert "search" not in sites.get("a.com")

    def test_find_by_name_and_guess(self, sites):
        sites.remember_profile("chatgpt.com", {"name": "ChatGPT", "type": "chat assistant"})
        assert sites.find_by_name("chat gpt") == "chatgpt.com"
        assert sites.find_by_name("ChatGPT") == "chatgpt.com"
        assert sites.find_by_name("etsy") is None
        assert sites.guess_domain("etsy") == "etsy.com"
        assert sites.guess_domain("weather.gov") == "weather.gov"

    def test_describe_for_prompt(self, sites):
        sites.remember_elements("weather.gov", {"search": {"selector": "#inputstring", "label": "City, St"}})
        sites.remember_profile("weather.gov", {"name": "National Weather Service", "type": "weather",
                                               "after_search": "read_text"})
        text = sites.describe("weather.gov")
        assert "National Weather Service" in text and "weather" in text
        assert 'act("search"' in text and "read_text" in text
        assert sites.describe("unknown.com") == ""


class TestInstantPath:
    """The instant path uses site memory and falls back sensibly — browser faked."""

    def _fake(self, monkeypatch, current_url, responses):
        import agent
        import server
        calls = []

        async def do_action(action, element=None, value=None, submit=False, selector=None):
            calls.append((action, value, selector))
            return responses(action, value, selector)

        monkeypatch.setattr(server, "do_action", do_action)
        monkeypatch.setattr(agent, "_emit", lambda msg: None)
        server.last_page = {"url": current_url, "title": "T"}
        return agent, calls

    def test_uses_remembered_search_box(self, sites, monkeypatch):
        import asyncio
        sites.remember_elements("youtube.com", {"search": {"selector": "#search", "label": "Search"}})
        sites.remember_profile("youtube.com", {"name": "YouTube", "type": "video"})
        agent, calls = self._fake(monkeypatch, "https://www.youtube.com/",
                                  lambda a, v, sel: {"success": True, "selector": "#search", "found": "memory"})
        out = asyncio.run(agent._run_site_command(parse_site_command("search cat videos")))
        assert out == "Searched YouTube for cat videos."
        assert calls == [("search", "cat videos", "#search")]

    def test_unknown_named_site_goes_to_ai(self, sites, monkeypatch):
        import asyncio
        agent, calls = self._fake(monkeypatch, "https://www.google.com/", lambda *a: {"success": True})
        assert asyncio.run(agent._run_site_command(parse_site_command("search wooden ramps on etsy"))) is None
        assert calls == []  # no blind etsy.com guess

    def test_learned_named_site_opens_it_first(self, sites, monkeypatch):
        import asyncio
        sites.remember_profile("etsy.com", {"name": "Etsy", "type": "shopping"})
        agent, calls = self._fake(monkeypatch, "https://www.google.com/",
                                  lambda a, v, sel: {"success": True, "selector": "input[name=\"q\"]"})
        out = asyncio.run(agent._run_site_command(parse_site_command("search wooden ramps on etsy")))
        assert calls[0] == ("open", "https://etsy.com", None)
        assert calls[1][0] == "search"
        assert out == "Searched Etsy for wooden ramps."

    def test_play_hands_off_to_agent_to_open_video(self, sites, monkeypatch):
        import asyncio
        agent, _ = self._fake(monkeypatch, "https://www.youtube.com/",
                              lambda a, v, sel: {"success": True, "selector": "#search"})
        out = asyncio.run(agent._run_site_command(parse_site_command("play wheelchair transfers")))
        assert out[0] == "agent" and "wheelchair transfers" in out[1]

    def test_no_search_box_falls_back_to_google(self, sites, monkeypatch):
        import asyncio

        def responses(action, value, selector):
            if action == "search":
                return {"success": False, "error": "No search box found on this page."}
            return {"success": True}

        agent, calls = self._fake(monkeypatch, "https://example.org/", responses)
        out = asyncio.run(agent._run_site_command(parse_site_command("search accessible vans")))
        assert out == "Searched Google for accessible vans."
        assert calls[-1] == ("open", "https://www.google.com/search?q=accessible+vans", None)

    def test_weather_site_search_goes_to_agent(self, sites, monkeypatch):
        import asyncio
        sites.remember_profile("weather.gov", {"name": "NWS", "type": "weather"})
        agent, calls = self._fake(monkeypatch, "https://www.weather.gov/", lambda *a: {"success": True})
        assert asyncio.run(agent._run_site_command(parse_site_command("search for Kansas City"))) is None
        assert calls == []

    def test_stale_remembered_box_is_forgotten(self, sites, monkeypatch):
        import asyncio
        sites.remember_elements("a.com", {"search": {"selector": "#old", "label": "Search"}})

        def responses(action, value, selector):
            if action == "search":
                return {"success": False, "error": "No search box found on this page."}
            return {"success": True}

        agent, _ = self._fake(monkeypatch, "https://a.com/", responses)
        asyncio.run(agent._run_site_command(parse_site_command("search shoes")))
        assert "search" not in sites.get("a.com")


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


class TestStepStream:
    """Each Strands tool call is turned into a step message for the side panel."""

    def _capture(self, monkeypatch):
        import agent
        sent = []
        monkeypatch.setattr(agent, "_emit", sent.append)
        return agent, sent

    def _after(self, name, text, status="success", cancel=None):
        from types import SimpleNamespace
        return SimpleNamespace(
            tool_use={"toolUseId": "t1", "name": name, "input": {}},
            result={"status": status, "content": [{"text": text}], "toolUseId": "t1"},
            cancel_message=cancel,
            duration=0.25,
        )

    def test_describe_inputs(self):
        from agent import _describe_input
        assert _describe_input("act", {"action": "type", "element": 3, "value": "cats", "submit": True}) == 'type #3 "cats" + submit'
        assert _describe_input("fill_form", {"fields": [{}, {}]}) == "2 fields"
        assert _describe_input("fill_form", {"fields": [{}]}) == "1 field"
        assert _describe_input("ask_user", {"question": "Married?"}) == "Married?"
        assert _describe_input("read_page", {}) == ""

    def test_before_sends_running_step(self, monkeypatch):
        from types import SimpleNamespace
        agent, sent = self._capture(monkeypatch)
        agent._on_before_tool(SimpleNamespace(tool_use={"toolUseId": "t1", "name": "act", "input": {"action": "click", "element": 7}}))
        assert sent == [{"type": "step", "step_id": "t1", "tool": "act", "input": "click #7", "status": "running"}]

    def test_after_ok(self, monkeypatch):
        agent, sent = self._capture(monkeypatch)
        agent._on_after_tool(self._after("act", "Done: click on 'Next'"))
        assert sent[0]["status"] == "ok"
        assert sent[0]["ms"] == 250
        assert sent[0]["detail"] == "Done: click on 'Next'"
        assert "id" not in sent[0]  # "id" is reserved for bridge command replies

    def test_after_error_text(self, monkeypatch):
        agent, sent = self._capture(monkeypatch)
        agent._on_after_tool(self._after("act", "Error: Element 9 not found."))
        assert sent[0]["status"] == "error"

    def test_after_fill_form_partial_failure(self, monkeypatch):
        agent, sent = self._capture(monkeypatch)
        agent._on_after_tool(self._after("fill_form", "Filled 1/2 fields. 1 failed\n  1. a: OK\n  2. element 9: FAIL — x"))
        assert sent[0]["status"] == "error"
        assert sent[0]["detail"] == "Filled 1/2 fields. 1 failed"

    def test_after_cancelled_question(self, monkeypatch):
        agent, sent = self._capture(monkeypatch)
        agent._on_after_tool(self._after("ask_user", agent._CANCELLED_ANSWER))
        assert sent[0]["status"] == "cancelled"


class TestLocationPrefix:
    def test_prefixes_title_and_url_only(self):
        import server
        from agent import _with_location
        server.last_page = {"title": "National Weather Service", "url": "https://www.weather.gov/",
                            "elements": [{"num": 1}]}
        out = _with_location("weather in Kansas City")
        assert out == "[You are on: National Weather Service — https://www.weather.gov/]\nweather in Kansas City"
        server.last_page = None

    def test_no_page_known(self):
        import server
        from agent import _with_location
        server.last_page = None
        assert _with_location("hello") == "hello"


class TestLearnSite:
    def test_learns_new_site_once_and_announces_it(self, sites, monkeypatch):
        import asyncio
        import agent
        import server
        sent, asked = [], []

        async def send_command(msg_type, **kw):
            asked.append(kw.get("action"))
            return {"url": "https://www.youtube.com/", "title": "YouTube", "headings": ["Home"],
                    "keys": {"search": {"selector": 'input[name="search_query"]', "label": "Search"}, "chat": None}}

        async def to_panel(msg):
            sent.append(msg)

        monkeypatch.setattr(server, "send_command", send_command)
        monkeypatch.setattr(server, "_send_to_client", to_panel)
        monkeypatch.setattr(agent, "_profile_site", lambda d, i: {"name": "YouTube", "type": "video",
                                                                  "summary": "Watch videos", "after_search": "open_result"})
        page = {"url": "https://www.youtube.com/watch?v=1", "title": "YouTube"}
        asyncio.run(agent.learn_site(page))
        asyncio.run(agent.learn_site(page))  # second visit: already learned, no browser call

        assert asked == ["site_info"]
        entry = sites.get("youtube.com")
        assert entry["type"] == "video" and entry["search"]["selector"] == 'input[name="search_query"]'
        assert sent[-1] == {"type": "site", "domain": "youtube.com", "name": "YouTube", "kind": "video",
                            "search": True, "chat": False, "known": True}

    def test_profile_failure_falls_back(self, monkeypatch):
        import agent

        class Boom:
            def converse(self, **kw):
                raise RuntimeError("no network")

        monkeypatch.setattr(agent.boto3, "client", lambda *a, **k: Boom())
        assert agent._profile_site("x.com", {"title": "X"}) == {"name": "X", "type": "other"}


class TestNewTab:
    """'new tab' in all its phrasings; only addresses and learned sites are instant."""

    def test_phrasings_with_an_address(self, sites):
        for text in ["new tab weather.gov", "open weather.gov in a new tab", "weather.gov in new tab",
                     "open a new tab with weather.gov", "Open weather.gov on new tab."]:
            assert try_direct(text) == ("new_tab", None, "https://weather.gov"), text

    def test_blank_new_tab(self, sites):
        assert try_direct("new tab") == ("new_tab", None, "https://google.com")
        assert try_direct("open a new tab") == ("new_tab", None, "https://google.com")

    def test_learned_site_by_name(self, sites):
        sites.remember_profile("youtube.com", {"name": "YouTube", "type": "video"})
        assert try_direct("New Tab YouTube") == ("new_tab", None, "https://youtube.com")
        assert try_direct("open youtube in a new tab") == ("new_tab", None, "https://youtube.com")

    def test_misheard_name_matches_learned_site(self, sites):
        sites.remember_profile("chatgpt.com", {"name": "ChatGPT", "type": "chat assistant"})
        sites.remember_profile("claude.ai", {"name": "Claude", "type": "chat assistant"})
        assert try_direct("open Chad GPT in new tab") == ("new_tab", None, "https://chatgpt.com")
        assert try_direct("open Cloud in new tab") == ("new_tab", None, "https://claude.ai")

    def test_unknown_name_goes_to_ai_not_a_guess(self, sites):
        # The bug: "Chad GPT" became chadgpt.com. Unknown names now go to the AI.
        assert try_direct("open Chad GPT in new tab") is None
        assert try_direct("new tab twitter") is None

    def test_not_a_new_tab_command(self, sites):
        assert try_direct("close this tab") is None


class TestSiteMemoryFuzzy:
    def test_find_similar(self, sites):
        sites.remember_profile("chatgpt.com", {"name": "ChatGPT"})
        assert sites.find_similar("chad gpt") == "chatgpt.com"
        assert sites.find_similar("chat gbt") == "chatgpt.com"
        assert sites.find_similar("netflix") is None

    def test_forget_site(self, sites):
        sites.remember_profile("chadgpt.com", {"name": "ChadGPT", "type": "other"})
        sites.forget_site("chadgpt.com")
        assert sites.get("chadgpt.com") == {}


class TestLearnSkipsBrokenPages:
    def test_error_page_not_learned(self, sites, monkeypatch):
        import asyncio
        import agent
        import server
        asked = []

        async def send_command(msg_type, **kw):
            asked.append(kw)
            return {}

        monkeypatch.setattr(server, "send_command", send_command)
        asyncio.run(agent.learn_site({"url": "https://www.chadgpt.com/", "title": "WordPress › Error", "count": 0}))
        assert asked == [] and sites.get("chadgpt.com") == {}


class TestFreshPageAfterActions:
    """Actions that bring up a new page/question return it, saving a read_page step."""

    def _fake(self, monkeypatch, action_result):
        import agent
        import server
        calls = []

        async def do_action(action, element=None, value=None, submit=False, selector=None):
            calls.append(("action", action, element))
            return dict(action_result(action, element))

        async def list_elements():
            calls.append(("list",))
            return {"title": "Q2", "count": 1, "elements": [{"num": 3, "type": "radio", "label": "Are you married? → No", "value": ""}]}

        monkeypatch.setattr(server, "do_action", do_action)
        monkeypatch.setattr(server, "list_elements", list_elements)
        monkeypatch.setattr(agent, "_bridge", lambda coro, timeout=15: asyncio_run(coro))
        return agent, calls

    def test_page_changed_rules(self):
        from agent import _page_changed
        assert _page_changed({"page": "loaded"}, "click")
        assert _page_changed({"changed": True}, "click")                     # Next swapped the question
        assert not _page_changed({"changed": True, "checked": True}, "click")  # just picked an answer
        assert not _page_changed({"changed": True}, "type")
        assert not _page_changed({"error": "x", "page": "loaded"}, "click")

    def test_fill_form_with_next_returns_next_question(self, monkeypatch):
        def result(action, element):
            if element == 7:
                return {"success": True, "label": "Yes", "checked": True, "changed": True}
            return {"success": True, "label": "Next", "changed": True}

        agent, calls = self._fake(monkeypatch, result)
        out = agent.fill_form._tool_func([{"element": 7, "action": "click"}, {"element": 12, "action": "click"}]) \
            if hasattr(agent.fill_form, "_tool_func") else agent.fill_form([{"element": 7, "action": "click"}, {"element": 12, "action": "click"}])
        assert "Page now" in out and "Are you married? → No" in out
        assert calls.count(("list",)) == 1

    def test_radio_click_alone_does_not_reread(self, monkeypatch):
        agent, calls = self._fake(monkeypatch, lambda a, e: {"success": True, "label": "Yes", "checked": True, "changed": True})
        out = agent.act._tool_func("click", 7) if hasattr(agent.act, "_tool_func") else agent.act("click", 7)
        assert "Page now" not in out and ("list",) not in calls


def asyncio_run(coro):
    import asyncio
    return asyncio.run(coro)


class TestOverlayCommands:
    def test_turn_numbers_on(self):
        for text in ["show numbers", "Show the numbers.", "turn on overlays", "overlay on", "numbers on",
                     "turn numbers on", "enable number tags"]:
            assert try_direct(text) == ("overlays", None, "on"), text

    def test_turn_numbers_off(self):
        for text in ["hide numbers", "Hide the numbers", "turn off overlay", "overlays off", "numbers off",
                     "turn the numbers off", "remove overlays"]:
            assert try_direct(text) == ("overlays", None, "off"), text

    def test_classified_as_instant(self):
        assert classify("hide numbers") == "direct"

    def test_tells_the_panel(self, monkeypatch):
        import asyncio
        import agent
        import server
        sent = []

        async def to_panel(msg):
            sent.append(msg)

        monkeypatch.setattr(server, "_send_to_client", to_panel)
        assert asyncio.run(agent._run_direct("hide numbers")) == "Numbers hidden."
        assert asyncio.run(agent._run_direct("show numbers")) == "Numbers shown on the page."
        assert sent == [{"type": "set_overlays", "on": False}, {"type": "set_overlays", "on": True}]


class TestSettingsCommands:
    """'settings <name> on|off' — the assistant's own settings, by voice or typed."""

    def test_settings_overlay(self):
        for text, want in [("settings overlay on", "on"), ("Settings: overlay off", "off"),
                           ("setting numbers on", "on"), ("settings, turn the overlay off.", "off"),
                           ("settings number tags off", "off")]:
            assert try_direct(text) == ("overlays", None, want), text

    def test_settings_speak(self):
        for text, want in [("settings speak on", "on"), ("Settings: speak off", "off"),
                           ("settings speech on", "on"), ("settings turn voice replies off", "off"),
                           ("settings read aloud on", "on")]:
            assert try_direct(text) == ("speak", None, want), text

    def test_short_forms_still_work(self):
        assert try_direct("overlay on") == ("overlays", None, "on")
        assert try_direct("hide numbers") == ("overlays", None, "off")

    def test_not_settings(self):
        assert try_direct("settings") is None
        assert try_direct("open the settings page") is None
        assert try_direct("settings speak loudly") is None

    def test_speak_tells_the_panel(self, monkeypatch):
        import asyncio
        import agent
        import server
        sent = []

        async def to_panel(msg):
            sent.append(msg)

        monkeypatch.setattr(server, "_send_to_client", to_panel)
        assert asyncio.run(agent._run_direct("settings speak on")) == "Replies will be read aloud."
        assert asyncio.run(agent._run_direct("settings speak off")) == "Replies will only be read aloud when you ask."
        assert sent == [{"type": "set_speak", "on": True}, {"type": "set_speak", "on": False}]


class TestSettingsAnyWordOrder:
    """The phrasings that failed live: settings must match by meaning, not word order."""

    def test_word_orders_that_failed(self):
        assert try_direct("turn settings overlay on") == ("overlays", None, "on")
        assert try_direct("overlay settings on") == ("overlays", None, "on")
        assert try_direct("Turn on the overlay please.") == ("overlays", None, "on")
        assert try_direct("show me the numbers") == ("overlays", None, "on")
        assert try_direct("switch the numbers off") == ("overlays", None, "off")
        assert try_direct("speech off") == ("speak", None, "off")
        assert try_direct("turn on voice replies") == ("speak", None, "on")
        assert try_direct("settings read aloud off") == ("speak", None, "off")

    def test_not_settings(self):
        for text in ["click number 5", "read it out loud", "turn on the lights in the kitchen",
                     "show me cat videos", "overlay on off", "turn speech and overlay on",
                     "scroll down", "open the settings page"]:
            assert try_direct(text) in (None,) or try_direct(text)[0] not in ("overlays", "speak"), text
