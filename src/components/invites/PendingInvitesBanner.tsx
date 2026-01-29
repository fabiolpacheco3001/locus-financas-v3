import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '@/i18n/useLocale';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingInvites, PendingInvite } from '@/hooks/usePendingInvites';
import { acceptHouseholdInviteById } from '@/lib/householdInvites';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface InviteCardProps {
  invite: PendingInvite;
  onAccept: (id: string) => Promise<void>;
  isAccepting: boolean;
}

function InviteCard({ invite, onAccept, isAccepting }: InviteCardProps) {
  const { t } = useLocale();

  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return t('invites.inbox.expired');
    if (diffDays === 1) return t('invites.inbox.expiresIn1Day');
    return t('invites.inbox.expiresInDays', { count: diffDays });
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t('invites.inbox.inviteTitle')}</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatExpiry(invite.expiresAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t('invites.inbox.roleLabel')}: <span className="font-medium">{t(`members.roles.${invite.role}`)}</span>
          </p>
          <Button
            size="sm"
            onClick={() => onAccept(invite.id)}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            {t('invites.inbox.accept')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PendingInvitesBanner() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { refreshMember } = useAuth();
  const { invites, loading, refetch } = usePendingInvites();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (inviteId: string) => {
    setAcceptingId(inviteId);
    setError(null);

    const result = await acceptHouseholdInviteById(inviteId);

    if (result.success) {
      toast.success(t('invites.join.success'));
      await refreshMember();
      navigate('/', { replace: true });
    } else {
      const errorKey = mapErrorToKey(result.error);
      setError(t(errorKey));
      refetch();
    }

    setAcceptingId(null);
  };

  const mapErrorToKey = (errorMsg?: string): string => {
    if (!errorMsg) return 'invites.errors.generic';
    if (errorMsg.includes('identity_already_exists')) return 'invites.errors.alreadyLinked';
    if (errorMsg.includes('invite_not_found')) return 'invites.errors.invalidOrExpired';
    if (errorMsg.includes('invite_expired')) return 'invites.errors.invalidOrExpired';
    if (errorMsg.includes('invite_already_used')) return 'invites.errors.invalidOrExpired';
    if (errorMsg.includes('invite_email_mismatch')) return 'invites.errors.emailMismatch';
    if (errorMsg.includes('not_authenticated')) return 'invites.errors.notAllowed';
    return 'invites.errors.generic';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">{t('invites.inbox.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('invites.inbox.desc')}</p>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {invites.map((invite) => (
          <InviteCard
            key={invite.id}
            invite={invite}
            onAccept={handleAccept}
            isAccepting={acceptingId === invite.id}
          />
        ))}
      </div>
    </div>
  );
}
