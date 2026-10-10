"""Slice 0: Prove Strands + Bedrock work. Run this, see a response, move on."""

from strands import Agent, tool


@tool
def get_time() -> str:
    """Returns the current time."""
    from datetime import datetime
    return datetime.now().strftime("%I:%M %p")


agent = Agent(
    system_prompt="You are a helpful voice assistant that controls a web browser. For now, just say hello and tell the user the time.",
    tools=[get_time],
)

response = agent("What time is it?")
print("\n--- Agent response ---")
print(response)
