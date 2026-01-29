import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/i18n/useLocale';
import {
  User,
  LogOut,
  Globe,
  Palette,
  Building2,
} from 'lucide-react';

export default function SettingsPage() {
  const { t } = useLocale();
  const { member, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <AppLayout>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('settings.profile')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between min-h-[44px]">
              <div>
                <p className="font-medium">{member?.name || 'Usuário'}</p>
                <p className="text-sm text-muted-foreground">{t('settings.memberSince')}</p>
              </div>
              <Badge variant="secondary">{member?.role || 'MEMBER'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.preferences')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label>{t('settings.language')}</Label>
              </div>
              <LanguageSelector showLabel={false} />
            </div>
            <Separator />
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label>{t('settings.theme')}</Label>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Notification Simulator Section - DEV ONLY (hidden in production) */}

        {/* Connections Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('settings.connections')}
            </CardTitle>
            <CardDescription>
              {t('settings.connectionsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full justify-between min-h-[52px]"
              disabled
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Open Finance</span>
              </div>
              <Badge variant="secondary">{t('common.comingSoon')}</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="destructive"
              className="w-full min-h-[48px]"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('common.signOut')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
