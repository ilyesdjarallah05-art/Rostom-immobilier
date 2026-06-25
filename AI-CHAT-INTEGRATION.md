# Rostom AI Chat Integration

This project includes a floating AI assistant in the bottom-right corner of every public page.

## Current version

The previous provider was **Puter.js**. It was removed because it can ask visitors to sign up or log in.

The widget now uses **Pollinations.ai text API** directly from the browser, so there is:

- no Puter.js script,
- no visitor login popup,
- no API key inside the website,
- no signup step for normal visitors,
- automatic local fallback if the free AI endpoint is busy, blocked, rate-limited, or offline.

## What visitors see

- A floating round **AI** button at the bottom-right.
- A popup bubble saying **“Can I help you?”**.
- A chat panel where visitors can ask about buying, renting, budget, location, property type, and available listings.
- Property cards linked to the matching listings on the website.

## Important notes

This is still a static HTML/CSS/JS website. Any AI service called directly from the browser can have public/free limits. The widget is designed safely:

1. It asks the AI to answer only using the website listings.
2. It does not expose any private API key.
3. If the AI endpoint fails, it continues working with local matching from the site listings.

For production with higher limits, use a backend or Supabase Edge Function with your own private API key. Do not put secret API keys in frontend JavaScript.

## Files changed

- `script.js`
  - Removed Puter.js loading.
  - Added direct Pollinations.ai call.
  - Kept the local listing matcher and fallback.
  - Updated the visitor note so it clearly says no visitor sign-up is needed.

- `style.css`
  - Keeps the existing floating chat UI and typing animation.

## How to test

Open the website through a local server or a deployed site, not by double-clicking `index.html`.

Example local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Click the bottom-right **AI** button and send a message like:

```text
I want a 4 room apartment in Batna
```

or:

```text
اريد شقة للكراء في باتنة
```

If the free AI endpoint is unavailable, the assistant will still return matching properties from the website.
