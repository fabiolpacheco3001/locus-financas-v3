import { useState } from 'react';
import { useLocale } from '@/i18n/useLocale';
import { createHouseholdInvite } from '@/lib/householdInvites';
import { buildInviteLink, copyToClipboard } from '@/lib/inviteUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, Link, AlertCircle, Key } from 'lucide-react';
import { toast } from 'sonner';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ValidityDays = 1 | 7 | 30;

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const { t } = useLocale();
  
  // Step 1: Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [validityDays, setValidityDays] = useState<ValidityDays>(7);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Step 2: Generated invite state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  
  // Copy state
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isStep2 = !!generatedToken;

  const handleCreateInvite = async () => {
    if (isCreating) return; // Prevent double submit
    
    setIsCreating(true);
    setError(null);
    
    try {
      const result = await createHouseholdInvite({
        email: email.trim() || undefined,
        role,
        daysValid: validityDays
      });
      
      if (result) {
        setGeneratedToken(result.token);
        setGeneratedLink(buildInviteLink(result.token));
        setExpiresAt(result.expiresAt);
      } else {
        setError(t('invites.errors.generic'));
      }
    } catch {
      setError(t('invites.errors.generic'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyToken = async () => {
    if (!generatedToken) return;
    
    const success = await copyToClipboard(generatedToken);
    if (success) {
      setCopiedToken(true);
      toast.success(t('invites.copied'));
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    
    const success = await copyToClipboard(generatedLink);
    if (success) {
      setCopiedLink(true);
      toast.success(t('invites.copied'));
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleClose = () => {
    // Reset all state
    setEmail('');
    setRole('MEMBER');
    setValidityDays(7);
    setGeneratedToken(null);
    setGeneratedLink(null);
    setExpiresAt(null);
    setCopiedToken(false);
    setCopiedLink(false);
    setError(null);
    onOpenChange(false);
  };

  const handleGenerateAnother = () => {
    setGeneratedToken(null);
    setGeneratedLink(null);
    setExpiresAt(null);
    setEmail('');
    setCopiedToken(false);
    setCopiedLink(false);
    setError(null);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isStep2 ? t('invites.dialog.generatedTitle') : t('invites.dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {isStep2 ? t('invites.dialog.oneTime') : t('invites.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isStep2 ? (
            // Step 1: Create form
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('invites.fields.emailOptional')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder={t('invites.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="invite-email-input"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-role">{t('invites.fields.role')}</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as 'ADMIN' | 'MEMBER')}>
                    <SelectTrigger id="invite-role" data-testid="invite-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">{t('members.roles.MEMBER')}</SelectItem>
                      <SelectItem value="ADMIN">{t('members.roles.ADMIN')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="invite-validity">{t('invites.fields.expires')}</Label>
                  <Select 
                    value={validityDays.toString()} 
                    onValueChange={(v) => setValidityDays(Number(v) as ValidityDays)}
                  >
                    <SelectTrigger id="invite-validity" data-testid="invite-validity-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t('common.days_one', { count: 1 })}</SelectItem>
                      <SelectItem value="7">{t('common.days_other', { count: 7 })}</SelectItem>
                      <SelectItem value="30">{t('common.days_other', { count: 30 })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            // Step 2: Generated invite
            <div className="space-y-4">
              {/* Token field */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5" />
                  {t('invites.token')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedToken}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="invite-token-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyToken}
                    className="shrink-0"
                    data-testid="copy-token-button"
                  >
                    {copiedToken ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">{t('invites.copyToken')}</span>
                  </Button>
                </div>
              </div>

              {/* Link field */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link className="h-3.5 w-3.5" />
                  {t('invites.link')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink || ''}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="invite-link-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0"
                    data-testid="copy-link-button"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">{t('invites.copyLink')}</span>
                  </Button>
                </div>
              </div>
              
              {/* Expiry badge */}
              {expiresAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">
                    {t('invites.expiresAt', { date: formatExpiry(expiresAt) })}
                  </Badge>
                </div>
              )}
              
              {/* Warning */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {t('invites.shownOnce')}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isStep2 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleCreateInvite} 
                disabled={isCreating}
                data-testid="generate-invite-button"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('invites.dialog.generate')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleGenerateAnother}>
                {t('invites.generateAnother')}
              </Button>
              <Button onClick={handleClose}>
                {t('common.close')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
