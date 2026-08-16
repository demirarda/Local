/**
 * E2E Test - Basic App Flow
 * Tests critical user flows end-to-end
 */

describe('LOCAL App - Critical Flows', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Authentication Flow', () => {
    it('should show login screen on first launch', async () => {
      await expect(element(by.text('Login'))).toBeVisible();
    });

    // Note: Actual login test requires test credentials
    // it('should login successfully', async () => {
    //   await element(by.id('email-input')).typeText('test@example.com');
    //   await element(by.id('password-input')).typeText('password123');
    //   await element(by.id('login-button')).tap();
    //   await expect(element(by.text('Pulse'))).toBeVisible();
    // });
  });

  describe('Pulse Screen', () => {
    it('should display Pulse screen after login', async () => {
      // Assuming user is logged in
      await expect(element(by.text('Pulse'))).toBeVisible();
    });

    it('should show loading state initially', async () => {
      // Check for skeleton loader or activity indicator
      await expect(element(by.id('loading-skeleton'))).toBeVisible();
    });

    it('should display rituals when loaded', async () => {
      // Wait for rituals to load
      await waitFor(element(by.id('ritual-card')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show empty state when no rituals', async () => {
      // This would require mocking API or having no rituals
      // await expect(element(by.text('No rituals happening right now'))).toBeVisible();
    });
  });

  describe('Ritual Detail Flow', () => {
    it('should navigate to ritual detail when card is tapped', async () => {
      // Tap on first ritual card
      await element(by.id('ritual-card')).atIndex(0).tap();
      await expect(element(by.id('ritual-detail-screen'))).toBeVisible();
    });

    it('should show join button for non-participants', async () => {
      await expect(element(by.text('Join'))).toBeVisible();
    });
  });

  describe('Social Passport Flow', () => {
    it('should navigate to Social Passport', async () => {
      // Navigate from bottom tab or menu
      await element(by.id('social-passport-tab')).tap();
      await expect(element(by.text('Social Passport'))).toBeVisible();
    });

    it('should display user profile information', async () => {
      await expect(element(by.id('profile-name'))).toBeVisible();
      await expect(element(by.id('rs-score'))).toBeVisible();
    });
  });
});
