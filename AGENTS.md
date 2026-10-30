# Project Architecture Rules

- Build administrative activity views from existing profile and visitor records, with client-side grouping, pagination, and cached parallel enrichment so the interface remains responsive without adding duplicate storage.
- Link Telegram chats to authenticated site accounts through short-lived, hashed, single-use tokens; check the linked profile on every customer message so ticket eligibility cannot be bypassed by finding the bot directly.