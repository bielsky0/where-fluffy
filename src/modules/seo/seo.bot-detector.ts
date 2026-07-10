// Known link-preview crawlers that need a static OG-tag HTML shell instead of the real SPA
// (which they can't execute JS in). Not an exhaustive bot list — this only needs to catch the
// social/chat platforms this app's "Udostępnij" share button realistically targets.
const CRAWLER_USER_AGENT_PATTERN =
  /facebookexternalhit|Twitterbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Discordbot/i;

export const isKnownCrawler = (userAgent: string | undefined): boolean =>
  Boolean(userAgent && CRAWLER_USER_AGENT_PATTERN.test(userAgent));
