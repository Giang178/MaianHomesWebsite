import asyncio

from app.modules.content.jobs.outbox_worker import process_one


async def _loop() -> None:
    while True:
        processed = await process_one()
        if not processed:
            await asyncio.sleep(2)


def start_marketing_jobs() -> list[asyncio.Task]:
    return [asyncio.create_task(_loop())]


async def stop_marketing_jobs(tasks: list[asyncio.Task]) -> None:
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass

