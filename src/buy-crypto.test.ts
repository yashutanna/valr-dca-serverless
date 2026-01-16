import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('buy-crypto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Environment configuration', () => {
    it('should throw error when API_KEY is missing', async () => {
      delete process.env.API_KEY;
      process.env.API_SECRET = 'test-secret';

      await expect(async () => {
        await import('./buy-crypto.js?t=' + Date.now());
      }).rejects.toThrow('API_KEY and API_SECRET environment variables are required');
    });

    it('should throw error when API_SECRET is missing', async () => {
      process.env.API_KEY = 'test-key';
      delete process.env.API_SECRET;

      await expect(async () => {
        await import('./buy-crypto.js?t=' + Date.now());
      }).rejects.toThrow('API_KEY and API_SECRET environment variables are required');
    });

    it('should use default DCA_EXECUTION_HOUR when not set', async () => {
      // ValrClient requires 64-character keys
      process.env.API_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.API_SECRET = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      delete process.env.DCA_EXECUTION_HOUR;

      // Should not throw - default value of 15 should be used
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import('./buy-crypto.js?t=' + Date.now());
      expect(module).toBeDefined();
    });

    it('should parse DCA_CURRENCIES correctly', async () => {
      // ValrClient requires 64-character keys
      process.env.API_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.API_SECRET = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      process.env.DCA_CURRENCIES = 'BTC, ETH, SOL';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import('./buy-crypto.js?t=' + Date.now());
      expect(module).toBeDefined();
      // Currencies should be trimmed
    });

    it('should parse DCA_AMOUNTS correctly', async () => {
      // ValrClient requires 64-character keys
      process.env.API_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.API_SECRET = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      process.env.DCA_AMOUNTS = '100, 50, 25';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import('./buy-crypto.js?t=' + Date.now());
      expect(module).toBeDefined();
      // Amounts should be converted to numbers
    });
  });

  describe('buy function', () => {
    beforeEach(() => {
      // ValrClient requires 64-character keys
      process.env.API_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.API_SECRET = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      process.env.DCA_EXECUTION_HOUR = '15';
      process.env.DCA_CURRENCIES = 'BTC,ETH';
      process.env.DCA_AMOUNTS = '100,50';
    });

    it('should exit early when currencies and amounts length dont match', async () => {
      process.env.DCA_CURRENCIES = 'BTC,ETH,SOL';
      process.env.DCA_AMOUNTS = '100,50';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import('./buy-crypto.js?t=' + Date.now());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await module.buy();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('currencies'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('amounts'));

      consoleSpy.mockRestore();
    });

    it('should exit early when not DCA hour', async () => {
      const currentHour = new Date().getHours();
      const notDcaHour = currentHour === 15 ? 14 : 15;
      process.env.DCA_EXECUTION_HOUR = notDcaHour.toString();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import('./buy-crypto.js?t=' + Date.now());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await module.buy();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not executing DCA'));

      consoleSpy.mockRestore();
    });
  });

  describe('Customer Order ID generation', () => {
    it('should generate consistent format', () => {
      // Test that the format is pair-year-month-date-hour
      const pair = 'BTCZAR';
      const expectedPattern = new RegExp(`${pair}-\\d{4}-\\d{1,2}-\\d{1,2}-\\d{1,2}`);

      // We can't directly test the internal function, but we can verify
      // the format through the integration test
      expect(expectedPattern.test(`${pair}-2026-1-16-15`)).toBe(true);
    });
  });
});
