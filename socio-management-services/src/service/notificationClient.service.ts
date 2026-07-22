import axios from 'axios';

export async function sendSocialPush(userId: string, title: string, body: string, deepLink: string, data: Record<string, unknown> = {}) {
  const key = String(process.env.INTERNAL_NOTIFICATION_API_KEY || '').trim();
  if (!key) return { skipped: true };
  const base = String(process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085').replace(/\/$/, '');
  try {
    return (await axios.post(`${base}/api/v1/notifications/internal/send`, { userId, title, body, deepLink, data }, { headers: { 'x-internal-api-key': key }, timeout: 4000 })).data;
  } catch (error) {
    console.error('[socio] push delivery failed', error instanceof Error ? error.message : String(error));
    return { failed: true };
  }
}
