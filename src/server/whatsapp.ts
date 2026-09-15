export interface WhatsAppOrderCompletion {
  recipientPhone: string;
  studentName: string;
  orderReference: string;
  serviceTitle: string;
  pinDetails?: { serial: string; pin: string };
}

export async function sendWhatsAppOrderCompletion(payload: WhatsAppOrderCompletion): Promise<boolean> {
  const endpoint = process.env.WHATSAPP_API_ENDPOINT;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!endpoint || !token) return false;

  let phone = payload.recipientPhone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = `234${phone.slice(1)}`;

  let message = `EduReach Hub Order Completed!\n\nHello ${payload.studentName},\nYour request for ${payload.serviceTitle} (Ref: ${payload.orderReference}) has been successfully processed.\n\n`;
  if (payload.pinDetails) {
    message += `Scratch Card Details:\nSerial: ${payload.pinDetails.serial}\nPIN: ${payload.pinDetails.pin}\n\n`;
  }
  message += 'Track your portal requests from your EduReach account.';

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
