const fs = require('fs');

async function sendEmail(to, subject, html, attachments = []) {
  try {
    if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) {
      throw new Error('BREVO_API_KEY or MAIL_FROM is missing on the server');
    }

    const payload = {
      sender: { name: 'Kyomatos Events', email: process.env.MAIL_FROM },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: 'Your ticket is ready',
    };

    // Convert attachments from the old format to what Brevo expects
    if (attachments && attachments.length > 0) {
      payload.attachment = attachments.map((a, i) => {
        let data = a.content;
        if (!data && a.path) data = fs.readFileSync(a.path);
        const base64 = Buffer.isBuffer(data)
          ? data.toString('base64')
          : a.encoding === 'base64'
            ? data
            : Buffer.from(String(data)).toString('base64');
        return { name: a.filename || 'ticket-' + (i + 1), content: base64 };
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const detail = await res.text();
      throw new Error('Brevo ' + res.status + ': ' + detail);
    }

    console.log('Email sent to', to);
    return { success: true, message: 'Email sent successfully' };
  } catch (err) {
    console.error('Email sending error:', err);
    return { success: false, message: err.message };
  }
}

module.exports = sendEmail;