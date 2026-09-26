// Strict allowlist HTML sanitizer for admin-authored rich content.
//
// Rich-text bodies are written by authenticated administrators but rendered to
// every visitor, so the render side must never trust the stored HTML. This
// sanitizer parses the markup, keeps only an allowlist of tags/attributes and
// drops everything else (including script/style/iframe/event handlers).
// Allowed inline styles are filtered property-by-property.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's',
  'blockquote', 'pre', 'code',
  'a', 'img', 'span', 'div',
]);

const ALLOWED_STYLE_PROPERTIES = new Set(['color', 'background-color', 'font-size', 'text-align']);

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .map((rule) => rule.trim())
    .filter((rule) => {
      const property = rule.split(':')[0]?.trim().toLowerCase();
      return Boolean(property && ALLOWED_STYLE_PROPERTIES.has(property) && rule.includes(':'));
    })
    .map((rule) => `${rule}`)
    .join('; ');
}

function safeHref(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeImgSrc(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith('data:image/')) return null; // no inline blobs — images live in Storage
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeRichHtml(input: string): string {
  if (!input || typeof document === 'undefined') return '';
  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(input, 'text/html');
  } catch {
    return '';
  }

  const root = parsed.body;

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag) || tag === 'script' || tag === 'style' || tag === 'iframe') {
        // Replace disallowed elements with their text content (keeps pasted text readable).
        const text = parsed.createTextNode(child.textContent || '');
        child.replaceWith(text);
        continue;
      }
      walk(child);
    }
  };
  walk(root);

  for (const element of Array.from(root.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase();
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (tag === 'a' && name === 'href') {
        const href = safeHref(attribute.value);
        if (href) {
          element.setAttribute('href', href);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer nofollow');
        } else {
          element.removeAttribute('href');
        }
        continue;
      }
      if (tag === 'img' && name === 'src') {
        const src = safeImgSrc(attribute.value);
        if (src) element.setAttribute('src', src);
        else element.remove();
        continue;
      }
      if (name === 'style') {
        const cleaned = sanitizeStyle(attribute.value);
        if (cleaned) element.setAttribute('style', cleaned);
        else element.removeAttribute('style');
        continue;
      }
      if (tag === 'img' && (name === 'alt' || name === 'width')) continue;
      element.removeAttribute(attribute.name);
    }
    if (tag === 'a' && !element.getAttribute('href')) {
      const text = parsed.createTextNode(element.textContent || '');
      element.replaceWith(text);
    }
  }

  return root.innerHTML;
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value || '');
}
