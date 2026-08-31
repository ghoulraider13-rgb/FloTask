/**
 * Client-side helper that sends free-form text (typed or spoken) to the
 * FloTask NLM endpoint and returns normalized actions.
 * The user's local time + timezone travel with the request so relative
 * phrases like "tomorrow at 6pm" resolve on the user's clock.
 */
export async function parseActions(text) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, currentTime: new Date().toISOString(), timezone }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data.actions) ? data.actions : [];
  } finally {
    clearTimeout(timer);
  }
}
