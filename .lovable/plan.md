

## Fix: Restore Sidebar Menu Spacing

### Investigation
The `SlideMenu.tsx` code is functionally identical to the original. The visual difference the user is seeing is likely caused by the `flex-1` class on the menu item text `<span>`, which was added to push the unread badge to the right. This makes the text span stretch to fill available space, subtly changing the perceived spacing.

### Fix (1 file)

**`src/components/SlideMenu.tsx`**

1. Change `gap-3` → `gap-2` on the Button className (line 193) to tighten icon-to-text spacing
2. Remove `flex-1` from the text `<span>` (line 199) — instead, only add `flex-1` on the inbox item that needs the badge pushed right, or use a different approach for badge positioning

Updated button markup:
```tsx
<Button
  variant="ghost"
  onClick={() => navigate(item.url)}
  className={cn(
    'w-full justify-start gap-2 h-10 px-3 rounded-md',
    ...
  )}
>
  <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-cyan-400')} />
  <span className="text-sm">{item.title}</span>
  {item.url === '/admin/inbox' && unreadCount > 0 && ... && (
    <span className="ml-auto ...">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Button>
```

- `gap-2` restores tighter 8px spacing between icon and text
- Removing `flex-1` from the span restores natural text width for all items
- `ml-auto` on the badge still pushes it right within the `w-full` flex container
- `shrink-0` on icon prevents it from shrinking

### Summary
- 1 file edited, 2 class changes
- Badge functionality preserved

