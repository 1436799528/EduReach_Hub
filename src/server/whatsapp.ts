export interface WhatsAppServiceCompletion {
  recipientPhone: string;
  studentName: string;
  requestReference: string;
  serviceTitle: string;
}

export async function sendWhatsAppServiceCompletion(payload: WhatsAppServiceCompletion): Promise<boolean> {
  const endpoint = process.env.WHATSAPP_API_ENDPOINT;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!endpoint || !token) return false;

  let phone = payload.recipientPhone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = `234${phone.slice(1)}`;

  const message = `EduReach Hub service update!\n\nHello ${payload.studentName},\nYour request for ${payload.serviceTitle} (Ref: ${payload.requestReference}) has been updated.\n\nTrack your request from your EduReach account.`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, to: phone, body: message }),
    });
    return response.ok;
  } catch (error) {
    console.error('WhatsApp notification failed:', error);
    return false;
  }
}
