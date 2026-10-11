"""Wipe everything the agent has learned and reload it from user_details.json.

Run before each rehearsal and before the real demo:
    python backend/reset_memory.py
"""

import asyncio
import os
import shutil

from memory_store import LocalMemoryStore

MEMORY_DIR = os.path.join(os.path.dirname(__file__), ".strands", "memory")


async def main():
    if os.path.isdir(MEMORY_DIR):
        shutil.rmtree(MEMORY_DIR)
    store = LocalMemoryStore(MEMORY_DIR)
    await store.initialize()
    keys = await store._storage.list()
    print(f"Memory reset: {len(keys)} details loaded from user_details.json")


if __name__ == "__main__":
    asyncio.run(main())
