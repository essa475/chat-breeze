# Logo, presence, Updates, and message gestures

## What will change
- Replace the current word-only identity with the uploaded Chat Ebola speech-bubble logo across the app and use a matching favicon.
- Add an Updates tab styled from the supplied references, with recent 24-hour photo/text statuses, viewed indicators, and a simple status composer.
- Show online, typing, and last-seen details beneath contact names in conversations; group chats show who is typing.
- Add right-to-left message swipe to reply on touch screens, with resistance, a reply cue, and haptic feedback where supported.
- Animate message deletion: the selected message shrinks and travels toward a briefly visible trash icon before disappearing. Reduced-motion users get a quick fade instead.

## Privacy and behavior
- Presence is visible only to signed-in people who already share a conversation.
- Typing is temporary and is never saved as message history.
- Last seen updates when a signed-in session becomes active or leaves; stale online sessions automatically display as last seen.
- Status posts expire after 24 hours. Authors can delete their own status; viewers can only read accessible statuses.
- Existing message delete rules remain unchanged: “for me” affects only the current person, while “for everyone” remains sender-only.

## Technical details
- Add protected presence and status tables with explicit grants, row-level access rules, expiry indexes, and realtime publication.
- Use realtime presence channels for typing and database-backed activity timestamps for reliable online/last-seen display.
- Add an Updates route and navigation item, reusing the existing private avatar storage flow for status media where appropriate.
- Add focused logo, status ring/list, presence label, swipe gesture, and deletion animation components without changing unrelated chat behavior.
- Update route metadata and generated database types required by the new screens.

## Validation
- Verify desktop and mobile layouts, logo/favicon, status creation/view/delete, online-to-last-seen transitions, typing indicators, swipe reply, both deletion modes, realtime updates, and reduced-motion behavior in the live preview.
