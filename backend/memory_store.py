"""Local memory store for Strands MemoryManager.

Stores user details as natural-language entries backed by LocalFileStorage
with BM25 search. Seed data from user_details.json is loaded on first run.
"""

import asyncio
import json
import os
import uuid

from strands.memory.types import MemoryEntry, SearchOptions
from strands.storage import LocalFileStorage
from strands.storage.search import Bm25SearchStrategy


class LocalMemoryStore:
    name = "user_details"
    description = "Remembered user details — name, address, phone, email, disability, etc."
    max_search_results = 30  # all saved details fit; forms need most of them at once
    writable = True
    extraction = False

    def __init__(self, storage_dir=None):
        if storage_dir is None:
            storage_dir = os.path.join(os.path.dirname(__file__), ".strands", "memory")
        self._storage = LocalFileStorage(storage_dir, search_strategy=Bm25SearchStrategy())
        self._storage_dir = storage_dir

    async def initialize(self):
        existing = await self._storage.list()
        if not existing:
            await self._seed_from_json()

    async def _seed_from_json(self):
        path = os.path.join(os.path.dirname(__file__), "user_details.json")
        if not os.path.exists(path):
            return
        with open(path) as f:
            details = json.load(f)

        field_map = {
            "first_name": "The user first name is {v}",
            "last_name": "The user last name is {v}",
            "date_of_birth": "The user date of birth is {v}",
            "email": "The user email is {v}",
            "phone": "The user phone number is {v}",
            "address": "The user street address is {v}",
            "city": "The user city is {v}",
            "state": "The user state is {v}",
            "zip": "The user zip code is {v}",
            "disability_type": "The user has a disability: {v}",
            "disability_start_date": "The user disability started on {v}",
            "veteran": "The user is {v} a veteran",
            "employed": "The user is {v} employed",
            "income": "The user income is {v}",
            # SSA eligibility questionnaire answers. Marital status is left out on
            # purpose so the agent asks one missing-detail question during the demo.
            "worked_and_paid_social_security_taxes": "The user has {v} worked and paid Social Security taxes",
            "unable_to_work_due_to_condition": "The user is {v} unable to work because of a condition",
            "condition_lasts_a_year_or_more": "The user's condition will {v} affect their ability to work for a year or more",
            "condition_started": "The user's condition started affecting their ability to work {v}",
            "little_or_no_income": "The user does {v} have little or no income and finds it hard to pay for essentials",
            "household_benefits": "Household benefits: {v}",
            "resources_value": "The value of the user's resources (things they own) is {v}",
            "permanent_kidney_failure": "The user does {v} have permanent kidney failure",
        }

        for key, template in field_map.items():
            if key not in details:
                continue
            val = details[key]
            if isinstance(val, bool):
                val = "" if val else "not"
            text = " ".join(template.format(v=val).split())
            await self._storage.write(key, text.encode("utf-8"))

    async def search(self, query, options=None):
        results = await self._storage.search(query)
        entries = []
        for r in results:
            data = await self._storage.read(r.key)
            if data:
                content = data.decode("utf-8") if isinstance(data, bytes) else data
                entries.append(MemoryEntry(content=content))

        if not entries:
            all_keys = await self._storage.list()
            for key in all_keys:
                data = await self._storage.read(key)
                if data:
                    content = data.decode("utf-8") if isinstance(data, bytes) else data
                    entries.append(MemoryEntry(content=content))

        limit = self.max_search_results
        if options and isinstance(options, dict) and options.get("max_search_results"):
            limit = options["max_search_results"]
        return entries[:limit]

    async def add(self, content, metadata=None):
        key = f"learned_{uuid.uuid4().hex[:8]}"
        await self._storage.write(key, content.encode("utf-8"))
        return key
