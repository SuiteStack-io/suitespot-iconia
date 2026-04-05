

## Fix: Chat Text Selection Color + Auto-Expanding Textarea

### Changes — 1 File

**File: `src/components/inbox/ConversationPanel.tsx`**

#### Fix 1: Text Selection Color
Add a CSS class with `::selection` styling to the outermost conversation wrapper div (line 223). Use Tailwind's arbitrary `[&_*::selection]` utility or add an inline `<style>` block scoped to the component. Selection color: light coral/orange (`bg: rgba(255, 166, 133, 0.4)`) so text remains readable on blue bubbles, dark bubbles, and white backgrounds.

#### Fix 2: Auto-Expanding Textarea
Replace the fixed-height textarea (lines 351-360) with an auto-resizing implementation:

- Remove `max-h-[40px]` constraint; set `min-h-[40px]` and `max-h-[120px]`
- Add a `ref` to the textarea
- Add an `autoResize` function that runs on every input: sets `height = 'auto'` then `height = scrollHeight + 'px'`
- Set `overflow-y: hidden` when content fits, `overflow-y: auto` when at max height
- Call autoResize in the `onChange` handler
- After sending (in `handleSend`), reset the textarea height back to initial
- Change `items-center` to `items-end` on the flex container so the send button stays bottom-aligned as the textarea grows
- Change border-radius from `rounded-full` to `rounded-2xl` so it looks natural when multi-line

No other files or components are changed.

