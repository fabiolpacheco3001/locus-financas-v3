import { useState, useCallback, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { mapAuthErrorToI18nKey } from '@/lib/authErrorMapper';
import { useLocale } from '@/i18n/useLocale';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { InputWithError } from '@/components/auth/InputWithError';
import { OnboardingCarousel } from '@/components/onboarding/OnboardingCarousel';

const ONBOARDING_COMPLETED_KEY = 'locus_onboarding_completed';

// Password strength requirements for signup
const PASSWORD_MIN_LENGTH = 8;

interface TouchedState {
  email: boolean;
  password: boolean;
  name: boolean;
  confirmPassword: boolean;
}

const initialTouched: TouchedState = {
  email: false,
  password: false,
  name: false,
  confirmPassword: false,
};

export default function AuthPage() {
  const { t } = useLocale();
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // Tab state - default to query param or 'login'
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab === 'signup' ? 'signup' : 'login';
  });
  
  // Onboarding state - check localStorage for first-time visitors
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(ONBOARDING_COMPLETED_KEY);
  });
  
  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setShowOnboarding(false);
  }, []);

  // Navigate to signup tab from onboarding
  const handleNavigateToSignup = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setShowOnboarding(false);
    setActiveTab('signup');
    setSearchParams({ tab: 'signup' });
  }, [setSearchParams]);
  
  // Touched state for fields
  const [loginTouched, setLoginTouched] = useState<TouchedState>(initialTouched);
  const [signupTouched, setSignupTouched] = useState<TouchedState>(initialTouched);
  const [loginDidSubmit, setLoginDidSubmit] = useState(false);
  const [signupDidSubmit, setSignupDidSubmit] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Validation helpers
  const isValidEmail = (email: string) => {
    return z.string().email().safeParse(email).success;
  };

  const isStrongPassword = (password: string) => {
    if (password.length < PASSWORD_MIN_LENGTH) return false;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return hasUppercase && hasLowercase && hasNumber && hasSymbol;
  };

  // Login validation - only required + valid email
  const getLoginErrors = useCallback(() => {
    const errors: { email?: string; password?: string } = {};
    
    if (!loginEmail.trim()) {
      errors.email = t('auth.errors.emailInvalid');
    } else if (!isValidEmail(loginEmail)) {
      errors.email = t('auth.errors.emailInvalid');
    }
    
    if (!loginPassword) {
      errors.password = t('auth.errors.generic');
    }
    
    return errors;
  }, [loginEmail, loginPassword, t]);

  // Signup validation - strong password + all fields
  const getSignupErrors = useCallback(() => {
    const errors: { name?: string; email?: string; password?: string; confirmPassword?: string } = {};
    
    if (!signupName.trim()) {
      errors.name = t('auth.validation.nameMinLength');
    } else if (signupName.trim().length < 2) {
      errors.name = t('auth.validation.nameMinLength');
    }
    
    if (!signupEmail.trim()) {
      errors.email = t('auth.errors.emailInvalid');
    } else if (!isValidEmail(signupEmail)) {
      errors.email = t('auth.errors.emailInvalid');
    }
    
    if (!signupPassword) {
      errors.password = t('auth.errors.passwordRules');
    } else if (signupPassword.length < PASSWORD_MIN_LENGTH) {
      errors.password = t('auth.errors.passwordRules');
    } else if (!isStrongPassword(signupPassword)) {
      errors.password = t('auth.errors.passwordWeak');
    }
    
    if (!signupConfirmPassword) {
      errors.confirmPassword = t('auth.validation.passwordsDoNotMatch');
    } else if (signupPassword !== signupConfirmPassword) {
      errors.confirmPassword = t('auth.validation.passwordsDoNotMatch');
    }
    
    return errors;
  }, [signupName, signupEmail, signupPassword, signupConfirmPassword, t]);

  const loginErrors = getLoginErrors();
  const signupErrors = getSignupErrors();

  // Check if error should be shown (touched or submitted)
  const shouldShowLoginError = (field: keyof TouchedState) => {
    return (loginTouched[field] || loginDidSubmit) && loginErrors[field as keyof typeof loginErrors];
  };

  const shouldShowSignupError = (field: keyof TouchedState) => {
    return (signupTouched[field] || signupDidSubmit) && signupErrors[field as keyof typeof signupErrors];
  };

  // Blur handlers
  const handleLoginBlur = (field: keyof TouchedState) => {
    setLoginTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSignupBlur = (field: keyof TouchedState) => {
    setSignupTouched(prev => ({ ...prev, [field]: true }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl opacity-50 bg-gradient-to-r from-primary via-emerald-500 to-primary animate-pulse" />
          <Loader2 className="relative h-10 w-10 animate-spin text-white" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  // Show onboarding carousel for first-time visitors
  if (showOnboarding) {
    return (
      <OnboardingCarousel 
        onComplete={handleOnboardingComplete} 
        onNavigateToSignup={handleNavigateToSignup}
      />
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginDidSubmit(true);
    
    const errors = getLoginErrors();
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);
    
    if (error) {
      toast.error(t(mapAuthErrorToI18nKey(error)));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupDidSubmit(true);
    
    const errors = getSignupErrors();
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsSubmitting(false);
    
    if (error) {
      toast.error(t(mapAuthErrorToI18nKey(error)));
    } else {
      toast.success(t('auth.success.accountCreated'));
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(t('auth.errors.generic'));
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Deep Dark Background */}
      <div className="absolute inset-0 bg-[#050508]" />
      
      {/* Animated Mesh Gradient */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary Gradient Blob */}
        <div 
          className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full opacity-30 blur-[120px] animate-pulse"
          style={{ 
            background: 'radial-gradient(circle, hsl(258 89% 50%) 0%, transparent 70%)',
            animationDuration: '8s'
          }}
        />
        {/* Secondary Green Blob */}
        <div 
          className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full opacity-25 blur-[100px] animate-pulse"
          style={{ 
            background: 'radial-gradient(circle, hsl(142 71% 45%) 0%, transparent 70%)',
            animationDuration: '10s',
            animationDelay: '2s'
          }}
        />
        {/* Accent Cyan Blob */}
        <div 
          className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] animate-pulse"
          style={{ 
            background: 'radial-gradient(circle, hsl(200 80% 55%) 0%, transparent 70%)',
            animationDuration: '12s',
            animationDelay: '4s'
          }}
        />
      </div>

      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Brand Header - Compact */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/90 to-primary/60 shadow-xl shadow-primary/25 mb-3">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
            Locus Finanças
          </h1>
          <p className="text-white/60 text-xs">
            O futuro das suas finanças começa aqui
          </p>
        </div>

        {/* Glassmorphism Card - Compact */}
        <div 
          className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-2xl"
          data-testid="auth-card"
        >
          {/* Inner Glow Effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative">
            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4 h-10 bg-white/5 hover:bg-white/10 text-white border-white/20 font-medium backdrop-blur-sm transition-all hover:border-white/30 hover:shadow-lg text-sm"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {t('auth.continueWithGoogle')}
            </Button>

            <div className="relative mb-4">
              <div className="flex items-center gap-3">
                <span className="flex-1 border-t border-white/10" />
                <span className="text-[10px] uppercase text-white/40 shrink-0">{t('auth.orContinueWith')}</span>
                <span className="flex-1 border-t border-white/10" />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-lg p-0.5 h-9">
                <TabsTrigger 
                  value="login" 
                  data-testid="login-tab"
                  className="rounded-md text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 transition-all h-8"
                >
                  {t('auth.login')}
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  data-testid="signup-tab"
                  className="rounded-md text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 transition-all h-8"
                >
                  {t('auth.signup')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-3" data-testid="login-form">
                  <div className="space-y-1">
                    <Label htmlFor="login-email" className="text-white/80 text-xs">{t('auth.email')}</Label>
                    <InputWithError
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      onBlur={() => handleLoginBlur('email')}
                      error={loginErrors.email}
                      showError={!!shouldShowLoginError('email')}
                      className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 text-sm"
                      data-testid="login-email-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="login-password" className="text-white/80 text-xs">{t('auth.password')}</Label>
                    <InputWithError
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onBlur={() => handleLoginBlur('password')}
                      error={loginErrors.password}
                      showError={!!shouldShowLoginError('password')}
                      className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 text-sm"
                      data-testid="login-password-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50 text-sm" 
                    disabled={isSubmitting} 
                    data-testid="login-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('auth.login')
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignup} className="space-y-2.5" data-testid="signup-form">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-white/80 text-xs">{t('auth.name')}</Label>
                    <InputWithError
                      id="signup-name"
                      type="text"
                      placeholder={t('auth.name')}
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      onBlur={() => handleSignupBlur('name')}
                      error={signupErrors.name}
                      showError={!!shouldShowSignupError('name')}
                      className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 text-sm"
                      data-testid="signup-name-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-white/80 text-xs">{t('auth.email')}</Label>
                    <InputWithError
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      onBlur={() => handleSignupBlur('email')}
                      error={signupErrors.email}
                      showError={!!shouldShowSignupError('email')}
                      className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 text-sm"
                      data-testid="signup-email-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-password" className="text-white/80 text-xs">{t('auth.password')}</Label>
                    <InputWithError
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      onBlur={() => handleSignupBlur('password')}
                      error={signupErrors.password}
                      showError={!!shouldShowSignupError('password')}
                      className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 text-sm"
                      data-testid="signup-password-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-confirm" className="text-white/80 text-xs">{t('auth.confirmPassword')}</Label>
                    <InputWithError
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      onBlur={() => handleSignupBlur('confirmPassword')}
                      error={signupErrors.confirmPassword}
                      showError={!!shouldShowSignupError('confirmPassword')}
                      className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 text-sm"
                      data-testid="signup-confirm-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50 text-sm" 
                    disabled={isSubmitting} 
                    data-testid="signup-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('auth.createAccount')
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            {/* Language selector */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <LanguageSelector showLabel={false} />
            </div>
          </div>
        </div>

        {/* Footer Text */}
        <p className="text-center text-white/30 text-[10px] mt-4">
          © 2025 Locus Finanças. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
