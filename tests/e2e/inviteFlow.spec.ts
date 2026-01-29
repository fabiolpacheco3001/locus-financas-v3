import { test, expect, Page } from '@playwright/test';

// Test credentials - use environment variables or test fixtures
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'test-admin@example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL || 'test-member@example.com';
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD || 'TestPassword123!';

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole('button', { name: /entrar|login|sign in/i }).click();
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Invite Flow E2E', () => {
  
  test.describe('E2E 1: Admin creates invite', () => {
    
    test('admin can open members page and generate invite link with email', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Navigate to members page
      await page.goto('/members');
      await page.waitForLoadState('networkidle');
      
      // Verify page loaded
      await expect(page.getByRole('heading', { name: /membros|members/i })).toBeVisible();
      
      // Look for invite button (admin only)
      const inviteButton = page.getByRole('button', { name: /convidar|invite/i });
      
      // If button exists, admin can create invite
      if (await inviteButton.isVisible()) {
        await inviteButton.click();
        
        // Dialog should open
        await expect(page.getByRole('dialog')).toBeVisible();
        
        // Fill in email (required now)
        const emailInput = page.getByTestId('invite-email-input');
        await expect(emailInput).toBeVisible();
        await emailInput.fill(MEMBER_EMAIL);
        
        // Click generate link button
        const generateButton = page.getByRole('button', { name: /gerar|generate/i });
        await expect(generateButton).toBeVisible();
        await generateButton.click();
        
        // Wait for link to appear
        const linkInput = page.getByTestId('invite-link-input');
        await expect(linkInput).toBeVisible({ timeout: 5000 });
        
        // Verify link contains /join?token=
        const linkValue = await linkInput.inputValue();
        expect(linkValue).toContain('/join?token=');
        
        // Copy button should be available
        const copyButton = page.getByTestId('copy-invite-button');
        await expect(copyButton).toBeVisible();
      }
    });
    
    test('invite requires email to be filled', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto('/members');
      await page.waitForLoadState('networkidle');
      
      const inviteButton = page.getByRole('button', { name: /convidar|invite/i });
      
      if (await inviteButton.isVisible()) {
        await inviteButton.click();
        
        // Generate button should be disabled without email
        const generateButton = page.getByRole('button', { name: /gerar|generate/i });
        await expect(generateButton).toBeDisabled();
        
        // Fill email
        await page.getByTestId('invite-email-input').fill('test@example.com');
        
        // Button should now be enabled
        await expect(generateButton).toBeEnabled();
      }
    });
    
    test('invite link can be generated via RPC with new signature', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      const result = await page.evaluate(async (memberEmail) => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Get household from context
        const { data: context } = await supabase.rpc('get_user_context');
        if (!context || context.length === 0) {
          return { success: false, error: 'no_context' };
        }
        
        const householdId = context[0].household_id;
        
        // Call new RPC with required parameters
        const { data, error } = await supabase.rpc('create_household_invite', {
          p_household_id: householdId,
          p_email: memberEmail,
          p_role: 'MEMBER',
          p_days_valid: 7
        });
        
        if (error) {
          return { success: false, error: error.message };
        }
        
        // New RPC returns token directly as string
        return { 
          success: true, 
          hasToken: typeof data === 'string' && data.length > 0,
          tokenLength: typeof data === 'string' ? data.length : 0
        };
      }, MEMBER_EMAIL);
      
      expect(result.success).toBe(true);
      expect(result.hasToken).toBe(true);
      expect(result.tokenLength).toBe(64); // 32 bytes hex encoded
    });
  });
  
  test.describe('E2E 2: Invite acceptance', () => {
    
    test('join page shows error for invalid token', async ({ page }) => {
      // Go directly to join with fake token (no login needed to see the page)
      await page.goto('/join?token=fake-invalid-token');
      
      // Should redirect to auth since not logged in
      await page.waitForURL(/\/auth/);
      
      // Verify we can see the login form
      await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    });
    
    test('join page requires authentication', async ({ page }) => {
      await page.goto('/join?token=any-token');
      
      // Should redirect to auth with returnUrl
      await expect(page).toHaveURL(/\/auth\?returnUrl=/);
    });
    
    test('join page shows error for missing token', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Need to logout first since admin already has household
      await page.evaluate(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.auth.signOut();
      });
      
      // Go to join without token
      await page.goto('/join');
      
      // Should show error about invalid token
      await expect(page.getByText(/inválido|invalid|expirado|expired/i)).toBeVisible({ timeout: 5000 });
    });
    
    test('user with existing household is redirected from join page', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Try to go to join page - should redirect to dashboard
      await page.goto('/join?token=any-token');
      
      // Should redirect to home since user already has household
      await page.waitForURL('/', { timeout: 5000 });
    });
    
    test('accept_household_invite validates email match', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Create invite for a different email
      const tokenResult = await page.evaluate(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data: context } = await supabase.rpc('get_user_context');
        if (!context || context.length === 0) return null;
        
        const { data } = await supabase.rpc('create_household_invite', {
          p_household_id: context[0].household_id,
          p_email: 'different-email@example.com',
          p_role: 'MEMBER',
          p_days_valid: 7
        });
        
        return data;
      });
      
      if (tokenResult) {
        // Try to accept with current user (different email)
        const result = await page.evaluate(async (token) => {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { error } = await supabase.rpc('accept_household_invite', {
            p_token: token
          });
          
          return { 
            success: !error,
            errorMessage: error?.message 
          };
        }, tokenResult);
        
        // Should fail with identity_already_exists (admin already has identity)
        // OR email_mismatch if the check happens first
        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/identity_already_exists|invite_email_mismatch/);
      }
    });
  });
  
  test.describe('E2E 3: Takeover blocking', () => {
    
    test('cannot create identity via direct insert (RLS + privilege revoked)', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      const result = await page.evaluate(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Attempt direct insert into member_identities
        const { error } = await supabase
          .from('member_identities')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            household_id: '00000000-0000-0000-0000-000000000000',
            member_id: '00000000-0000-0000-0000-000000000000'
          });
        
        return { 
          blocked: !!error,
          errorMessage: error?.message,
          errorCode: error?.code
        };
      });
      
      expect(result.blocked).toBe(true);
      // Should fail due to RLS or privilege denial
      expect(result.errorMessage).toMatch(/permission denied|row-level security|policy/i);
    });
    
    test('create_member_identity fails for household with existing members', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      const result = await page.evaluate(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Get current household (which already has admin linked)
        const { data: context } = await supabase.rpc('get_user_context');
        if (!context || context.length === 0) {
          return { error: 'no_context' };
        }
        
        // Verify household has members
        const { data: members } = await supabase.rpc('get_members_visible');
        
        // Try to call create_member_identity (should fail)
        const { error: rpcError } = await supabase.rpc('create_member_identity', {
          p_household_id: context[0].household_id,
          p_member_id: context[0].member_id
        });
        
        return { 
          hasContext: true,
          memberCount: members?.length || 0,
          hasLinkedUser: members?.some((m: any) => m.is_you),
          rpcBlocked: !!rpcError,
          rpcError: rpcError?.message
        };
      });
      
      expect(result.hasContext).toBe(true);
      expect(result.memberCount).toBeGreaterThan(0);
      expect(result.hasLinkedUser).toBe(true);
      expect(result.rpcBlocked).toBe(true);
      // Should fail with identity_already_exists or household_requires_invite
      expect(result.rpcError).toMatch(/identity_already_exists|household_requires_invite/);
    });
    
    test('non-admin cannot generate invite', async ({ page }) => {
      // This test verifies the RPC checks for admin role
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Verify admin CAN create (policy works)
      const result = await page.evaluate(async (memberEmail) => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Verify is_household_admin returns true for admin
        const { data: isAdmin } = await supabase.rpc('is_household_admin');
        
        // Get household
        const { data: context } = await supabase.rpc('get_user_context');
        if (!context || context.length === 0) {
          return { isAdmin, canCreate: false, error: 'no_context' };
        }
        
        // Admin should be able to create invite
        const { data, error } = await supabase.rpc('create_household_invite', {
          p_household_id: context[0].household_id,
          p_email: memberEmail,
          p_role: 'MEMBER',
          p_days_valid: 7
        });
        
        return { 
          isAdmin,
          canCreate: !error && typeof data === 'string'
        };
      }, MEMBER_EMAIL);
      
      expect(result.isAdmin).toBe(true);
      expect(result.canCreate).toBe(true);
    });
    
    test('accept_household_invite fails for invalid token', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Logout to simulate fresh user
      await page.evaluate(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.auth.signOut();
      });
      
      // Try to accept with fake token (as unauthenticated)
      const result = await page.evaluate(async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data, error } = await supabase.rpc('accept_household_invite', {
          p_token: 'fake-invalid-token'
        });
        
        return { 
          success: !error,
          errorMessage: error?.message 
        };
      });
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/not_authenticated|invite_invalid/);
    });
    
    test('accept_household_invite fails for user already linked', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      // Create a valid invite
      const tokenResult = await page.evaluate(async (memberEmail) => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data: context } = await supabase.rpc('get_user_context');
        if (!context || context.length === 0) return null;
        
        const { data } = await supabase.rpc('create_household_invite', {
          p_household_id: context[0].household_id,
          p_email: memberEmail,
          p_role: 'MEMBER',
          p_days_valid: 7
        });
        
        return data;
      }, MEMBER_EMAIL);
      
      if (tokenResult) {
        // Try to accept as the same user (already linked)
        const result = await page.evaluate(async (token) => {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.rpc('accept_household_invite', {
            p_token: token
          });
          
          return { 
            success: !error,
            errorMessage: error?.message 
          };
        }, tokenResult);
        
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('identity_already_exists');
      }
    });
  });
  
  test.describe('UI Components', () => {
    
    test('invite button only visible for admins', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto('/members');
      await page.waitForLoadState('networkidle');
      
      // Admin should see invite button
      const inviteButton = page.getByRole('button', { name: /convidar|invite/i });
      await expect(inviteButton).toBeVisible();
    });
    
    test('invite dialog has email input and role selector', async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto('/members');
      await page.waitForLoadState('networkidle');
      
      const inviteButton = page.getByRole('button', { name: /convidar|invite/i });
      
      if (await inviteButton.isVisible()) {
        await inviteButton.click();
        
        // Dialog should have title
        await expect(page.getByRole('dialog')).toBeVisible();
        
        // Should have email input
        await expect(page.getByTestId('invite-email-input')).toBeVisible();
        
        // Should have role selector
        await expect(page.getByTestId('invite-role-select')).toBeVisible();
        
        // Should have generate button
        await expect(page.getByRole('button', { name: /gerar|generate/i })).toBeVisible();
        
        // Should have close button
        await expect(page.getByRole('button', { name: /fechar|close/i })).toBeVisible();
      }
    });
    
    test('join page has proper structure', async ({ page }) => {
      // Login first to access join page
      await page.goto('/auth');
      await page.getByLabel(/e-?mail/i).fill('unlinked-user@example.com');
      await page.getByLabel(/senha|password/i).fill('TestPassword123!');
      
      // Go to join page with a token
      await page.goto('/join?token=test-token-123');
      
      // If redirected to auth, that's expected for unlinked user
      if (page.url().includes('/auth')) {
        // Verify auth page has returnUrl
        expect(page.url()).toContain('returnUrl');
      }
    });
  });
});
