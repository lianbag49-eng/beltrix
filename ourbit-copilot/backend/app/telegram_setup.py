import argparse
from urllib.parse import urlparse
import httpx
from .config import settings


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    args=parser.parse_args()
    parsed=urlparse(args.url)
    if parsed.scheme!='https' or parsed.path!='/api/telegram/webhook' or parsed.username or parsed.password or parsed.query:
        raise SystemExit('Use the HTTPS CRM URL ending in /api/telegram/webhook')
    if not settings.telegram_bot_token or not settings.telegram_webhook_secret:
        raise SystemExit('Configure Telegram secrets in the server environment first')
    try:
        response=httpx.post(f'https://api.telegram.org/bot{settings.telegram_bot_token}/setWebhook',
            json={'url':args.url,'secret_token':settings.telegram_webhook_secret,'allowed_updates':['message']},timeout=15)
        response.raise_for_status()
        success=response.json().get('ok')
    except (httpx.HTTPError,ValueError):
        raise SystemExit('Webhook registration failed; check server credentials and connectivity') from None
    if not success:
        raise SystemExit('Telegram rejected webhook registration')
    print('Telegram webhook registered. No credentials were printed.')


if __name__=='__main__':
    main()
