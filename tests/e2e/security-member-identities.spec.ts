import { test, expect, Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oqrmzibxambkjnatreep.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcm16aWJ4YW1ia2puYXRyZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjkzMjksImV4cCI6MjA4MzkwNTMyOX0.ku8lsZATIaBzpUBOzzHuI6_w2aK4vDNPZKZj4L3aqpo';
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Fill email - supports i18n placeholders (pt/en/es)
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]');
  await emailInput.first().fill(E2E_EMAIL!);

  // Fill password - supports i18n labels (pt/en/es)
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.first().fill(E2E_PASSWORD!);

  // Click sign in button - supports i18n (pt/en/es)
  const signInButton = page.getByRole('button', { name: /entrar|sign in|iniciar sesión|login/i });
  await signInButton.click();

  // Wait for navigation away from auth page
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
}

async function getSupabaseAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    // Supabase stores session in localStorage with key sb-<ref>-auth-token
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          return (
            parsed?.access_token ??
            parsed?.currentSession?.access_token ??
            parsed?.session?.access_token ??
            null
          );
        } catch {
          // ignore parse errors
        }
      }
    }
    return null;
  });

  if (!token) throw new Error('Could not get Supabase access_token from localStorage.');
  return token;
}

test.describe('Security: member_identities RLS policies', () => {
  test.beforeEach(async () => {
    // Skip tests if E2E credentials are not configured
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      test.skip(true, 'E2E_EMAIL and E2E_PASSWORD environment variables are required');
    }
  });

  test('user can SELECT only their own identity (new policy: mi_select_own)', async ({ page, request }) => {
    await login(page);
    const accessToken = await getSupabaseAccessToken(page);

    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/member_identities?select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Accept-Profile': 'public',
        },
      }
    );

    // User should be able to SELECT, but only their own row(s)
    expect(res.status()).toBe(200);
    const data = await res.json();
    // Should return at most 1 row (their own identity) due to UNIQUE constraint
    expect(data.length).toBeLessThanOrEqual(1);
  });

  test('UPDATE is blocked (mi_block_update policy)', async ({ page, request }) => {
    await login(page);
    const accessToken = await getSupabaseAccessToken(page);

    // Attempt to update own member_identities row (should fail due to RLS)
    const res = await request.patch(
      `${SUPABASE_URL}/rest/v1/member_identities?user_id=not.is.null`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Accept-Profile': 'public',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        data: JSON.stringify({ household_id: '00000000-0000-0000-0000-000000000000' }),
      }
    );

    // UPDATE blocked by RLS USING(false) - expect empty result or error
    if (res.status() === 200) {
      const data = await res.json();
      // No rows should be updated
      expect(data).toEqual([]);
    } else {
      // Could also return 403 or other error
      expect([204, 403, 404]).toContain(res.status());
    }
  });

  test('DELETE is blocked (mi_block_delete policy)', async ({ page, request }) => {
    await login(page);
    const accessToken = await getSupabaseAccessToken(page);

    // Attempt to delete own member_identities row (should fail due to RLS)
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/member_identities?user_id=not.is.null`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Accept-Profile': 'public',
          'Prefer': 'return=representation',
        },
      }
    );

    // DELETE blocked by RLS USING(false) - expect no rows deleted
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toEqual([]);
    } else {
      expect([204, 403, 404]).toContain(res.status());
    }
  });

  test('INSERT for another user_id is blocked (hijack prevention)', async ({ page, request }) => {
    await login(page);
    const accessToken = await getSupabaseAccessToken(page);

    // Attempt to insert identity for a DIFFERENT user (should fail)
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/member_identities`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Accept-Profile': 'public',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        data: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000001', // Not auth.uid()
          member_id: '00000000-0000-0000-0000-000000000002',
          household_id: '00000000-0000-0000-0000-000000000003',
        }),
      }
    );

    // Should fail - user_id != auth.uid()
    expect([400, 403]).toContain(res.status());
  });

  test('INSERT into linked household is blocked (hijack prevention)', async ({ page, request }) => {
    await login(page);
    const accessToken = await getSupabaseAccessToken(page);

    // First, get user's current household (which is already linked)
    const identityRes = await request.get(
      `${SUPABASE_URL}/rest/v1/member_identities?select=household_id`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Accept-Profile': 'public',
        },
      }
    );
    
    const identityData = await identityRes.json();
    if (identityData.length === 0) {
      // User has no identity yet, skip this test
      test.skip(true, 'User has no existing identity to test against');
      return;
    }

    const existingHouseholdId = identityData[0].household_id;

    // Get the user's actual uid from the token
    const uid = await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            return parsed?.user?.id ?? null;
          } catch {
            // ignore
          }
        }
      }
      return null;
    });

    // Attempt to insert another identity into the SAME household (should fail)
    // Even with correct user_id, household is already linked
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/member_identities`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Accept-Profile': 'public',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        data: JSON.stringify({
          user_id: uid,
          member_id: '00000000-0000-0000-0000-000000000099',
          household_id: existingHouseholdId, // Already has links
        }),
      }
    );

    // Should fail - household already has linked identities OR user already has identity (UNIQUE)
    expect([400, 403, 409, 500]).toContain(res.status());
  });
});

test.describe('Security: member_identities (unauthenticated)', () => {
  test('anonymous SELECT returns empty', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/member_identities?select=*&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Accept-Profile': 'public',
        },
      }
    );

    // Anonymous - RLS policy targets authenticated only, should return empty
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toEqual([]);
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test('anonymous INSERT is blocked', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/member_identities`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Accept-Profile': 'public',
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000001',
          member_id: '00000000-0000-0000-0000-000000000002',
          household_id: '00000000-0000-0000-0000-000000000003',
        }),
      }
    );

    // Anonymous should be blocked
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('App functionality after RLS update', () => {
  test.beforeEach(async () => {
    if (!E2E_EMAIL || !E2E_PASSWORD) {
      test.skip(true, 'E2E_EMAIL and E2E_PASSWORD environment variables are required');
    }
  });

  test('get_user_context RPC returns household after login', async ({ page, request }) => {
    await login(page);
    const accessToken = await getSupabaseAccessToken(page);

    // Call the get_user_context RPC which should work via SECURITY DEFINER
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/rpc/get_user_context`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data: '{}',
      }
    );

    expect(res.status()).toBe(200);
    const data = await res.json();
    // Should return at least one row with household_id and member_id
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0]).toHaveProperty('household_id');
    expect(data[0]).toHaveProperty('member_id');
    expect(data[0].household_id).not.toBeNull();
  });

  test('app loads dashboard and displays household data (smoke)', async ({ page }) => {
    // Fail fast on runtime errors
    page.on('pageerror', (e) => {
      throw e;
    });

    await login(page);

    // Verify dashboard/main content loaded successfully
    // This confirms the app can fetch household context
    await expect(
      page.getByText(/dashboard|painel|saldo|balance|receitas|income/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Navigate to Members to verify household-scoped data works
    const membersLink = page.getByRole('link', { name: /membros|members|miembros/i }).first();
    
    if (await membersLink.isVisible()) {
      await membersLink.click();
      await page.waitForLoadState('networkidle');
      // Members page should load without error
      await expect(page.locator('body')).not.toContainText(/error|erro|exception/i);
    }
  });
});
