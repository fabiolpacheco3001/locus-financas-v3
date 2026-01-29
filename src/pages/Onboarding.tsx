import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/i18n/useLocale';
import { supabase } from '@/integrations/supabase/client';
import { getMyPendingInvites, acceptHouseholdInviteById } from '@/lib/householdInvites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Plus, Mail, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface PendingInvite {
  id: string;
  householdId: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, householdId, refreshMember } = useAuth();
  const { t } = useLocale();
  
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [householdName, setHouseholdName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if user already has a household
  useEffect(() => {
    if (!authLoading && householdId) {
      navigate('/', { replace: true });
    }
  }, [authLoading, householdId, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Load pending invites
  useEffect(() => {
    if (!user || householdId) {
      setLoadingInvites(false);
      return;
    }

    const loadInvites = async () => {
      setLoadingInvites(true);
      try {
        const invites = await getMyPendingInvites();
        setPendingInvites(invites);
      } catch (err) {
        console.error('Failed to load invites:', err);
      } finally {
        setLoadingInvites(false);
      }
    };

    loadInvites();
  }, [user, householdId]);

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!householdName.trim() || !user) {
      setError(t('onboarding.errors.nameRequired'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('create_household_with_admin', {
        p_household_name: householdName.trim(),
        p_user_id: user.id,
        p_member_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
        p_member_email: user.email || null
      });

      if (rpcError) {
        console.error('Failed to create household:', rpcError);
        setError(rpcError.message || t('onboarding.errors.createFailed'));
        setIsCreating(false);
        return;
      }

      if (data) {
        toast.success(t('onboarding.success.householdCreated'));
        await refreshMember();
        navigate('/', { replace: true });
      } else {
        setError(t('onboarding.errors.createFailed'));
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Error creating household:', err);
      setError(t('onboarding.errors.createFailed'));
      setIsCreating(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setAcceptingId(inviteId);
    setError(null);

    try {
      const result = await acceptHouseholdInviteById(inviteId);

      if (result.success) {
        toast.success(t('invites.join.success'));
        await refreshMember();
        navigate('/', { replace: true });
      } else {
        const errorKey = mapErrorToKey(result.error);
        setError(t(errorKey));
        // Reload invites to update the list
        const invites = await getMyPendingInvites();
        setPendingInvites(invites);
      }
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError(t('invites.errors.generic'));
    } finally {
      setAcceptingId(null);
    }
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

  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loadingInvites) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('onboarding.title')}</h1>
          <p className="text-muted-foreground">{t('onboarding.description')}</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Household Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{t('onboarding.createHousehold.title')}</CardTitle>
              </div>
              <CardDescription>{t('onboarding.createHousehold.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateHousehold} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="householdName">{t('onboarding.createHousehold.nameLabel')}</Label>
                  <Input
                    id="householdName"
                    placeholder={t('onboarding.createHousehold.namePlaceholder')}
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    disabled={isCreating}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isCreating || !householdName.trim()}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('onboarding.createHousehold.button')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Join with Invite Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{t('onboarding.joinHousehold.title')}</CardTitle>
              </div>
              <CardDescription>{t('onboarding.joinHousehold.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingInvites.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {t('onboarding.joinHousehold.inviteReceived')}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t('onboarding.joinHousehold.expiresAt', { date: formatExpiry(invite.expiresAt) })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={acceptingId === invite.id}
                      >
                        {acceptingId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t('onboarding.joinHousehold.accept')
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('onboarding.joinHousehold.noInvites')}
                  </p>
                  <Link to="/join">
                    <Button variant="outline" className="w-full">
                      {t('onboarding.joinHousehold.useToken')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link to="/auth">
            <Button variant="ghost">{t('common.back')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
