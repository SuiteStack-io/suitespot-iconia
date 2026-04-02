import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

export function UnreadMessagesBadge() {
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => navigate('/admin/inbox')}
      aria-label="Guest messages"
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[11px] leading-none"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
