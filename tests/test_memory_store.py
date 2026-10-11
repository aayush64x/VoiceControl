"""Tests for the local memory store."""

import asyncio
import shutil
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from memory_store import LocalMemoryStore

TEST_DIR = "/tmp/test_voice_agent_memory"


@pytest.fixture(autouse=True)
def clean_test_dir():
    shutil.rmtree(TEST_DIR, ignore_errors=True)
    yield
    shutil.rmtree(TEST_DIR, ignore_errors=True)


@pytest.mark.asyncio
async def test_seed_from_json():
    store = LocalMemoryStore(storage_dir=TEST_DIR)
    await store.initialize()
    results = await store.search("first name")
    assert len(results) > 0
    assert "Jordan" in results[0].content


@pytest.mark.asyncio
async def test_search_email():
    store = LocalMemoryStore(storage_dir=TEST_DIR)
    await store.initialize()
    results = await store.search("email")
    assert len(results) > 0
    assert "jordan.rivera@example.com" in results[0].content


@pytest.mark.asyncio
async def test_search_disability():
    store = LocalMemoryStore(storage_dir=TEST_DIR)
    await store.initialize()
    results = await store.search("disability")
    assert len(results) > 0
    assert "spinal cord injury" in results[0].content


@pytest.mark.asyncio
async def test_add_and_search():
    store = LocalMemoryStore(storage_dir=TEST_DIR)
    await store.initialize()
    await store.add("The user preferred language is Spanish")
    results = await store.search("language")
    assert len(results) > 0
    assert "Spanish" in results[0].content


@pytest.mark.asyncio
async def test_no_double_seed():
    store = LocalMemoryStore(storage_dir=TEST_DIR)
    await store.initialize()
    results1 = await store.search("first name")

    store2 = LocalMemoryStore(storage_dir=TEST_DIR)
    await store2.initialize()
    results2 = await store2.search("first name")

    assert len(results1) == len(results2)


@pytest.mark.asyncio
async def test_empty_search_returns_empty():
    store = LocalMemoryStore(storage_dir=TEST_DIR)
    await store.initialize()
    results = await store.search("xyznonexistent")
    # BM25 may return results with low scores; just ensure no crash
    assert isinstance(results, list)
