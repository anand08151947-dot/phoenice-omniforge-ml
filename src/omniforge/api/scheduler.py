"""Singleton APScheduler instance for pipeline cron jobs."""
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
