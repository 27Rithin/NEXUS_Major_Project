import asyncio
import logging
from arq import create_pool
from arq.connections import RedisSettings
from config import settings
from services.social_agent import SocialMediaAgent

logger = logging.getLogger(__name__)

async def automated_monitoring_loop():
    """
    Scheduler loop that enqueues ingestion jobs into ARQ.
    Gracefully degrades if Redis is unavailable.
    """
    redis = None
    retry_delay = 10  # Start with 10s, back off to 60s

    while True:
        try:
            if redis is None:
                logger.info("Connecting to Redis for monitoring scheduler...")
                redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
                retry_delay = 10  # Reset on successful connection
                logger.info("Redis connection established for monitoring.")

            # Generate mock post
            mock_text = SocialMediaAgent.generate_mock_post()
            
            # Enqueue job to ARQ
            await redis.enqueue_job('ingest_social_signal', mock_text)
            logger.info(f"Enqueued ingestion job for: {mock_text[:50]}...")

            await asyncio.sleep(30)

        except Exception as e:
            logger.warning(f"Monitoring scheduler error (retrying in {retry_delay}s): {e}")
            redis = None  # Force reconnection on next iteration
            await asyncio.sleep(retry_delay)
            retry_delay = min(60, retry_delay * 2)  # Exponential backoff, cap at 60s
