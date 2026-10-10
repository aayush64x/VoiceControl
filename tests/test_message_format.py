"""Tests for the message format between extension and backend (plan.md spec)."""

import json


VALID_MESSAGE_TYPES = {
    "panel_to_backend": ["user_said", "answer"],
    "backend_to_panel": ["step", "ask", "say"],
    "backend_to_page": ["command"],
    "page_to_backend": ["result"],
}


def make_message(msg_type, **kwargs):
    return {"type": msg_type, **kwargs}


class TestUserSaidMessage:
    def test_has_required_fields(self):
        msg = make_message("user_said", text="scroll down")
        assert msg["type"] == "user_said"
        assert "text" in msg

    def test_serializes_to_json(self):
        msg = make_message("user_said", text="click 7")
        serialized = json.dumps(msg)
        parsed = json.loads(serialized)
        assert parsed["text"] == "click 7"


class TestStepMessage:
    def test_has_required_fields(self):
        msg = make_message("step", tool="read_page", input={}, output={"elements": []}, status="success")
        assert msg["type"] == "step"
        assert msg["tool"] == "read_page"
        assert msg["status"] == "success"

    def test_status_values(self):
        for status in ["success", "error", "running"]:
            msg = make_message("step", tool="act", input={}, output={}, status=status)
            assert msg["status"] == status


class TestAskMessage:
    def test_yes_no_question(self):
        msg = make_message("ask", question="Submit the form?", yes_no=True)
        assert msg["yes_no"] is True

    def test_open_question(self):
        msg = make_message("ask", question="What is your date of birth?", yes_no=False)
        assert msg["yes_no"] is False


class TestAnswerMessage:
    def test_text_answer(self):
        msg = make_message("answer", text="1985-03-14", source="typed")
        assert msg["text"] == "1985-03-14"
        assert msg["source"] == "typed"

    def test_voice_answer(self):
        msg = make_message("answer", text="yes", source="voice")
        assert msg["source"] == "voice"

    def test_button_answer(self):
        msg = make_message("answer", text="yes", source="button")
        assert msg["source"] == "button"


class TestCommandMessage:
    def test_click_command(self):
        msg = make_message("command", action="click", element=7)
        assert msg["action"] == "click"
        assert msg["element"] == 7

    def test_type_command(self):
        msg = make_message("command", action="type", element=3, value="hello")
        assert msg["action"] == "type"
        assert msg["value"] == "hello"

    def test_scroll_command(self):
        msg = make_message("command", action="scroll", direction="down")
        assert msg["action"] == "scroll"

    def test_valid_actions(self):
        valid = ["click", "type", "scroll", "back", "open", "press_key", "read"]
        for action in valid:
            msg = make_message("command", action=action)
            assert msg["action"] == action


class TestResultMessage:
    def test_success_result(self):
        msg = make_message("result", success=True, data={"elements": [{"num": 1, "type": "button", "label": "Go"}]})
        assert msg["success"] is True

    def test_error_result(self):
        msg = make_message("result", success=False, error="Element 99 not found")
        assert msg["success"] is False
        assert "not found" in msg["error"]


class TestMessageRoundTrip:
    """Messages must survive JSON serialization over WebSocket."""

    def test_all_types_roundtrip(self):
        messages = [
            make_message("user_said", text="open weather.gov"),
            make_message("step", tool="act", input={"action": "open", "url": "https://weather.gov"}, output={}, status="success"),
            make_message("ask", question="Submit?", yes_no=True),
            make_message("answer", text="yes", source="voice"),
            make_message("command", action="click", element=5),
            make_message("result", success=True, data={}),
            make_message("say", text="The form has been submitted."),
        ]
        for msg in messages:
            roundtripped = json.loads(json.dumps(msg))
            assert roundtripped == msg
