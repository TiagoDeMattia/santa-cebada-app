"""
Gestor de eventos SSE para el visor de barriles.
Mantiene una cola asyncio por cliente conectado y hace broadcast
cuando hay cambios (pinchado / despinchado).
"""
import asyncio
from typing import Set

_queues: Set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=10)
    _queues.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _queues.discard(q)


async def broadcast(event: str = "barrel_update") -> None:
    for q in list(_queues):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass  # cliente lento: descartamos; se refrescará en la próxima hora
