"""Run from backend: python -m app.manage provision (credentials entered without echo)."""
import argparse
from getpass import getpass
from sqlalchemy import select, delete
from .db import SessionLocal
from .models import User, Session
from .security import hasher


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['provision', 'disable'])
    parser.add_argument('--slot', type=int, choices=[1, 2, 3], required=True)
    args = parser.parse_args()
    with SessionLocal() as db:
        user = db.get(User, args.slot)
        if args.command == 'disable':
            if not user:
                raise SystemExit('User does not exist')
            user.active = False
        else:
            email = input('Employee email: ').strip().lower()
            name = input('Display name: ').strip()
            role = input('Role (admin/reviewer/analyst): ').strip()
            telegram = input('Telegram numeric user ID (blank to disable): ').strip()
            password = getpass('New password (at least 14 characters): ')
            confirm = getpass('Confirm password: ')
            if '@' not in email or not name or role not in ('admin','reviewer','analyst') or len(password) < 14 or password != confirm:
                raise SystemExit('Invalid input; nothing changed')
            if not user:
                user = User(id=args.slot)
                db.add(user)
            user.email, user.name, user.role = email, name, role
            user.password_hash, user.active = hasher.hash(password), True
            user.telegram_id = int(telegram) if telegram else None
        db.execute(delete(Session).where(Session.user_id == args.slot))
        db.commit()
    print('Employee updated; previous sessions revoked.')


if __name__ == '__main__':
    main()
