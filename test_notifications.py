#!/usr/bin/env python3
"""Quick script to check notifications in the database."""
import asyncio
from app.core.database import async_session_maker
from app.models.notification import Notification
from app.models.artist import Artist
from sqlalchemy import select

async def main():
    async with async_session_maker() as db:
        # Get all notifications
        result = await db.execute(
            select(Notification).order_by(Notification.created_at.desc())
        )
        notifications = result.scalars().all()

        print(f"Total notifications in database: {len(notifications)}")
        print(f"Unread: {len([n for n in notifications if not n.is_read])}")
        print()

        if notifications:
            print("Recent notifications:")
            for n in notifications[:5]:
                print(f"  - Type: {n.notification_type}")
                print(f"    Message: {n.message}")
                print(f"    Read: {n.is_read}")
                print(f"    Created: {n.created_at}")
                print()
        else:
            print("No notifications found in database.")
            print("This means no artist has requested payment yet,")
            print("or the notification creation is not working.")

if __name__ == "__main__":
    asyncio.run(main())
