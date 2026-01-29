import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/i18n/useLocale';
import { supabase } from '@/integrations/supabase/client';
import { normalizeToken, isValidTokenFormat } from '@/lib/inviteUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

type PreviewState = 'idle' | 'loading' | 'valid' | 'invalid' | 'expired' | 'used';

interface InvitePreview {
  householdId: string;
  expiresAt: string;
  isValid: boolean;
}

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, householdId, refreshMember } = useAuth();
  const { t } = useLocale();
  
  const rawToken = searchParams.get('token');
  const tokenFromUrl = rawToken ? normalizeToken(rawToken) : '';
  
  const [manualToken, setManualToken] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const effectiveToken = tokenFromUrl || normalizeToken(manualToken);

  // If user already has a household, redirect to dashboard
  useEffect(() => {
    if (!authLoading && householdId) {
      navigate('/', { replace: true });
    }
  }, [authLoading, householdId, navigate]);

  // Auto-load preview if token is in URL
  const loadPreview = useCallback(async (token: string) => {
    if (!token || !isValidTokenFormat(token)) {
      setPreviewState('invalid');
      return;
    }

    setPreviewState('loading');
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_household_invite_preview', {
        p_token: token
      });

      if (rpcError) {
        console.error('Preview RPC error:', rpcError);
        setPreviewState('invalid');
        return;
      }

      if (!data || data.length === 0) {
        setPreviewState('invalid');
        return;
      }

      const result = data[0];
      
      if (!result.is_valid) {
        // Determine if expired or used based on expiry
        const expiresAt = result.expires_at ? new Date(result.expires_at) : null;
        if (expiresAt && expiresAt < new Date()) {
          setPreviewState('expired');
        } else {
          setPreviewState('used');
        }
        return;
      }

      setPreview({
        householdId: result.household_id,
        expiresAt: result.expires_at,
        isValid: result.is_valid
      });
      setPreviewState('valid');
    } catch {
      setPreviewState('invalid');
    }
  }, []);

  // Auto-preview when we have a token from URL and user is logged in
  useEffect(() => {
    if (!authLoading && user && tokenFromUrl && previewState === 'idle') {
      loadPreview(tokenFromUrl);
    }
  }, [authLoading, user, tokenFromUrl, previewState, loadPreview]);

  const handleValidate = () => {
    const token = normalizeToken(manualToken);
    if (token) {
      loadPreview(token);
    }
  };

  const handleAccept = async () => {
    if (isAccepting || !effectiveToken) return;
    
    setIsAccepting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('accept_household_invite', {
        p_token: effectiveToken
      });

      if (rpcError) {
        const errorKey = mapRpcErrorToKey(rpcError.message);
        setError(t(errorKey));
        setIsAccepting(false);
        return;
      }

      if (data) {
        setSuccess(true);
        await refreshMember();
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } else {
        setError(t('invites.errors.generic'));
        setIsAccepting(false);
      }
    } catch {
      setError(t('invites.errors.generic'));
      setIsAccepting(false);
    }
  };

  const mapRpcErrorToKey = (errorMsg?: string): string => {
    if (!errorMsg) return 'invites.errors.generic';
    if (errorMsg.includes('identity_already_exists') || errorMsg.includes('already_in_household')) {
      return 'invites.errors.alreadyInHousehold';
    }
    if (errorMsg.includes('invite_invalid_or_expired') || errorMsg.includes('invalid_token')) {
      return 'invites.errors.invalidOrExpired';
    }
    if (errorMsg.includes('token_expired')) {
      return 'invites.preview.expired';
    }
    if (errorMsg.includes('token_used')) {
      return 'invites.preview.used';
    }
    if (errorMsg.includes('invite_email_mismatch')) {
      return 'invites.errors.emailMismatch';
    }
    if (errorMsg.includes('not_authenticated')) {
      return 'invites.errors.notAllowed';
    }
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in - redirect to auth with return URL
  if (!user) {
    const currentUrl = effectiveToken 
      ? `/join?token=${encodeURIComponent(effectiveToken)}`
      : '/join';
    return <Navigate to={`/auth?returnUrl=${encodeURIComponent(currentUrl)}`} replace />;
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4">{t('invites.join.success')}</CardTitle>
            <CardDescription>{t('invites.join.redirecting')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/expired/used states
  if (previewState === 'invalid' || previewState === 'expired' || previewState === 'used') {
    const StateIcon = previewState === 'expired' ? Clock : XCircle;
    const stateMessage = 
      previewState === 'expired' ? t('invites.preview.expired') :
      previewState === 'used' ? t('invites.preview.used') :
      t('invites.preview.invalid');

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <StateIcon className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="mt-4">{stateMessage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retry-token">{t('invites.join.pasteToken')}</Label>
              <Input
                id="retry-token"
                placeholder={t('invites.join.tokenPlaceholder')}
                value={manualToken}
                onChange={(e) => {
                  setManualToken(e.target.value);
                  setPreviewState('idle');
                }}
              />
            </div>
            <Button 
              onClick={handleValidate} 
              className="w-full"
              disabled={!manualToken.trim()}
            >
              {t('invites.preview.ctaValidate')}
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/">
              <Button variant="ghost">{t('common.back')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Loading preview
  if (previewState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <CardTitle className="mt-4">{t('common.loading')}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Valid preview - show accept button
  if (previewState === 'valid' && preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="mt-4">{t('invites.preview.valid')}</CardTitle>
            <CardDescription>{t('invites.join.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {preview.expiresAt && (
              <div className="flex justify-center">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('invites.expiresAt', { date: formatExpiry(preview.expiresAt) })}
                </Badge>
              </div>
            )}

            <Button 
              onClick={handleAccept} 
              className="w-full" 
              disabled={isAccepting}
              data-testid="accept-invite-button"
            >
              {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('invites.preview.ctaAccept')}
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/">
              <Button variant="ghost">{t('common.back')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Idle state - no token or waiting for input
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">{t('invites.join.title')}</CardTitle>
          <CardDescription>{t('invites.join.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="manualToken">{t('invites.join.pasteToken')}</Label>
            <Input
              id="manualToken"
              placeholder={t('invites.join.tokenPlaceholder')}
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              data-testid="manual-token-input"
            />
          </div>

          <Button 
            onClick={handleValidate} 
            className="w-full" 
            disabled={!manualToken.trim()}
            data-testid="validate-token-button"
          >
            {t('invites.preview.ctaValidate')}
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/auth">
            <Button variant="ghost">{t('common.back')}</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
