# Chat interaction polish

## What will change
- Open selected photos, videos, and files in a full-screen preview before sending, with the file name above, a caption field below, recipient name, and Send button.
- Keep attachment captions attached to the outgoing message and show the resulting media naturally inside the conversation.
- Rebuild reaction badges so they sit below messages without cutting the bubble, and add a plus button that opens a larger emoji picker.
- Add long-press/right-click selection to the chat list, with Delete chat and Clear chat actions that only hide content for the current person.
- Fix group creation so the group and its members are created safely together.
- Show recent chat contacts below group search, making member selection faster.
- Add smooth animated transitions between Chats, Find, Requests, and Settings without page-like flashing.
- Upgrade the message field with smooth expansion, focus animation, attachment controls, and a recording-style idle/send transition.

## Technical details
- Add a focused attachment-preview component and stage files locally before uploading.
- Adjust reaction spacing and picker state in the conversation screen.
- Extend chat-list selection state and use existing per-user message hiding for Clear chat; leaving/deleting a chat only changes the current user’s membership/view.
- Add a protected database function for atomic group creation and call it from the group screen.
- Derive recent group candidates from existing direct conversations.
- Use TanStack navigation with keyed CSS transitions and reduced-motion support.

## Validation
- Check mobile and desktop layouts, attachment preview, reaction picker, list selection, group creation, recent contacts, and tab transitions in the live preview.
