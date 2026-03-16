

## iMessage-Style Chat Bubbles for ConversationPanel

Update `src/components/inbox/ConversationPanel.tsx` to match the iMessage reference design. No changes to thread list or other files.

### Bubble Styling

**Operator (right-aligned):**
- `bg-[#007AFF]`, white text, `rounded-[18px]` with `rounded-br-[6px]` for tail effect
- `max-w-[75%]`, padding `py-[10px] px-[16px]`
- `shadow-sm` (0 1px 2px rgba(0,0,0,0.1))

**Guest (left-aligned):**
- `bg-[#2C2C2E]`, white text, `rounded-[18px]` with `rounded-bl-[6px]` for tail effect
- Same max-width, padding, shadow

### Timestamps
- Move outside the bubble, below it, centered under the bubble
- `text-[11px] text-gray-400`, with status indicators inline

### "Guest via OTA" Label
- Show only when the previous message was from a different sender (first in a sequence)
- Small muted text above the bubble

### Spacing
- Same-sender consecutive messages: `mt-1` (4px)
- Different-sender messages: `mt-3` (12px)
- Determine by comparing `messages[i].sender` with `messages[i-1].sender`

### Chat Area Background
- White background on the messages scroll area: `bg-white`

### Reply Input
- Light gray background bar: `bg-gray-100`
- Rounded input field with `rounded-full` styling
- Blue send button matching `bg-[#007AFF]` with white arrow icon, circular shape

### Message Text
- `text-[15px]` font size, normal weight

### Implementation
- Iterate messages with index to access previous message for grouping logic
- Replace current `space-y-3` with manual margin classes based on sender grouping
- Attachment links: white text for both bubble types (both have dark/blue backgrounds now)

