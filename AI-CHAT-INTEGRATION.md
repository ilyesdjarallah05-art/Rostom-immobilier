# Rostom AI Chat Integration

This project now includes a floating AI assistant in the bottom-right corner of every public page.

## What was added

- A floating round **AI** button at the bottom-right.
- A popup text bubble saying **“Can I help you?”**, translated through `i18n.js`.
- A chat panel where visitors can ask about buying, renting, budget, location, property type, and available listings.
- Real AI replies through **Puter.js**.
- No API key is stored in the website code.
- A safe fallback: if the external AI provider is unavailable, the widget still searches the website listings locally and returns matching property cards.

## Why no API key is inside the frontend

Putting OpenAI/OpenRouter/Hugging Face API keys directly in HTML or JavaScript exposes the key to every visitor. Anyone could copy it from DevTools and use your account.

For a totally free static website, the safest no-backend option is Puter.js because it works from frontend JavaScript without adding your own API key.

## Files changed

- `i18n.js`
  - Added all AI assistant, homepage extra section, category, gallery, and admin helper translation keys in English, French, and Arabic.
  - Extended the existing translation architecture to support translated aria labels and titles.

- `script.js`
  - Removed the separate `EXTRA_TRANSLATIONS` block so the code now uses the existing `t()` / `data-i18n` architecture.
  - Added the Puter.js loader.
  - Added real AI prompt generation for Rostom Immobilier.
  - Kept listing-based property matching so the AI does not invent unavailable properties.
  - Added fallback local answers.

- `style.css`
  - Added the small “AI is writing” animation.
  - Modernized the language dropdown with a polished pill selector that fits the navigation and mobile menu.

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

## Notes

The AI provider is loaded only when the visitor sends a message. This keeps the website lighter on first load.
