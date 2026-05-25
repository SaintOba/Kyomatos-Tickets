const nodemailer = require('nodemailer');

async function sendEmail(to, subject, html, attachments = []) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
      text: 'Your ticket is ready',
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    await transporter.sendMail(mailOptions);
    console.log('Email sent to', to);
    return { success: true, message: 'Email sent successfully' };
  } catch (err) {
    console.error('Email sending error:', err);
    return { success: false, message: err.message };
  }
}

module.exports = sendEmail;
