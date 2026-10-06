# Visitors activity redesign

## What will change
- Replace the long IP-only table with one searchable activity center grouped by account.
- Show username, account ID, status, last activity, location, IP, device, visit count, and recent paths together.
- Include signed-up accounts with no recorded activity so every account is represented.
- Keep anonymous visitors in a separate, clearly labeled group.
- Add quick filters for all, active today, signed-in, and anonymous traffic.

## Speed improvements
- Load accounts and recent activity together instead of resolving every IP one after another.
- Render results immediately, then resolve only missing visible locations in parallel.
- Cache resolved locations in the browser so repeat visits do not trigger the same lookup.
- Add pagination so the page remains quick as traffic grows.

## Technical details
- Rework the existing admin Visitors page only; access remains restricted to administrators.
- Use existing account and visitor records, without changing login or tracking behavior.
- Keep the current black-and-white design system and make the layout responsive.
- Verify the finished page at desktop and phone widths, including search, filters, expansion, and pagination.
