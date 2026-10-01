/**
 * robots.txt support for the newsroom fetcher.
 *
 * EduReach reads publicly published pages, but it still honours the crawl
 * rules an operator publishes. Ignoring robots.txt is both rude and a legal
 * risk for a platform that republishes source metadata, so the fetcher asks
 * permission before every host is touched.
 */

export interface RobotsRule {
  allow: boolean;
  path: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelaySeconds: number | null;
}

export interface RobotsPolicy {
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Set when the file was fetched but was not a usable robots.txt. */
  parseError?: string;
}

export function parseRobots(text: string): RobotsPolicy {
  const policy: RobotsPolicy = { groups: [], sitemaps: [] };
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelaySeconds: null };
        policy.groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    if (field === 'sitemap') {
      policy.sitemaps.push(value);
      continue;
    }

    if (!current) continue;
    lastWasAgent = false;

    if (field === 'disallow' || field === 'allow') {
      // "Disallow:" with an empty value means "nothing is disallowed".
      if (field === 'disallow' && value === '') continue;
      current.rules.push({ allow: field === 'allow', path: value });
      continue;
    }

    if (field === 'crawl-delay') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed) && parsed >= 0) current.crawlDelaySeconds = parsed;
    }
  }

  return policy;
}

/** Most specific matching group wins; `*` is the fallback. */
export function groupFor(policy: RobotsPolicy, userAgent: string): RobotsGroup | null {
  const ua = String(userAgent || '').toLowerCase().split('/')[0].trim();
  let best: RobotsGroup | null = null;
  let bestLength = -1;
  let fallback: RobotsGroup | null = null;

  for (const group of policy.groups) {
    for (const agent of group.agents) {
      if (agent === '*') {
        fallback = fallback || group;
        continue;
      }
      if (ua && (ua.startsWith(agent) || agent.startsWith(ua)) && agent.length > bestLength) {
        best = group;
        bestLength = agent.length;
      }
    }
  }

  return best || fallback;
}

function ruleToRegExp(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = anchored ? path.slice(0, -1) : path;
  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

/** Longest-match rule wins, with Allow winning ties (the Google convention). */
export function isPathAllowed(policy: RobotsPolicy, userAgent: string, path: string): boolean {
  const group = groupFor(policy, userAgent);
  if (!group || !group.rules.length) return true;

  const target = path || '/';
  let decision = true;
  let bestLength = -1;

  for (const rule of group.rules) {
    if (!ruleToRegExp(rule.path).test(target)) continue;
    const specificity = rule.path.replace(/\$$/, '').length;
    if (specificity > bestLength || (specificity === bestLength && rule.allow)) {
      decision = rule.allow;
      bestLength = specificity;
    }
  }

  return decision;
}

export function crawlDelayMs(policy: RobotsPolicy, userAgent: string): number | null {
  const group = groupFor(policy, userAgent);
  if (!group?.crawlDelaySeconds) return null;
  return Math.min(group.crawlDelaySeconds * 1000, 30_000);
}
