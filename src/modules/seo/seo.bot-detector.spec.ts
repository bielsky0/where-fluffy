import { isKnownCrawler } from './seo.bot-detector.js';

describe('isKnownCrawler', () => {
  it.each([
    'facebookexternalhit/1.1',
    'Twitterbot/1.0',
    'Slackbot-LinkExpanding 1.0',
    'WhatsApp/2.23.20.0',
    'TelegramBot (like TwitterBot)',
    'LinkedInBot/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0;)',
  ])('recognizes %s as a known crawler', (userAgent) => {
    expect(isKnownCrawler(userAgent)).toBe(true);
  });

  it('returns false for a regular browser user-agent', () => {
    expect(isKnownCrawler('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false);
  });

  it('returns false when the user-agent header is missing', () => {
    expect(isKnownCrawler(undefined)).toBe(false);
  });
});
