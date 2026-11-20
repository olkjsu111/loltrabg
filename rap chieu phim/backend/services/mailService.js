const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getMailConfig() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const fromName = (process.env.SMTP_FROM_NAME || 'Night Movie Cinema').trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user).trim();

  return { host, port, secure: port === 465, user, pass, fromName, fromEmail };
}

function getTransporter() {
  const cfg = getMailConfig();
  if (!cfg.user || !cfg.pass) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });
  }

  return cachedTransporter;
}

/**
 * Gửi email chứa mã OTP 6 chữ số để đặt lại mật khẩu
 */
async function sendPasswordResetOtpEmail({ to, recipientName, otpCode, expiresMinutes = 5 }) {
  const cfg = getMailConfig();
  const transporter = getTransporter();

  if (!transporter) {
    const err = new Error(
      'Máy chủ chưa cấu hình Gmail SMTP (SMTP_USER và SMTP_PASS - App Password) để gửi mã OTP.'
    );
    err.statusCode = 503;
    throw err;
  }

  const safeName = recipientName || 'Quý khách';
  const subject = `[Night Movie] Mã OTP xác nhận đặt lại mật khẩu: ${otpCode}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f121a; color: #e2e8f0; border-radius: 16px; overflow: hidden; border: 1px solid #262c3f;">
      <div style="background: linear-gradient(135deg, #be123c, #881337); padding: 24px 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; color: #ffffff; letter-spacing: 0.5px;">NIGHT MOVIE CINEMA</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #fecdd3;">Yêu cầu đặt lại mật khẩu tài khoản</p>
      </div>
      <div style="padding: 28px;">
        <p style="margin: 0 0 14px; font-size: 15px; color: #f8fafc;">Xin chào <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhập mã OTP gồm 6 chữ số dưới đây để xác nhận:
        </p>
        <div style="background: #181d2b; border: 1px dashed #e11d48; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #ffffff; font-family: 'Courier New', monospace;">
            ${otpCode}
          </div>
          <p style="margin: 10px 0 0; font-size: 12px; color: #94a3b8;">
            Mã có hiệu lực trong <strong>${expiresMinutes} phút</strong> và chỉ dùng 1 lần.
          </p>
        </div>
        <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #94a3b8;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và không chia sẻ mã OTP cho bất kỳ ai.
        </p>
      </div>
    </div>
  `;

  const text = `Xin chào ${safeName},\n\nMã OTP đặt lại mật khẩu Night Movie của bạn là: ${otpCode}\nMã có hiệu lực trong ${expiresMinutes} phút.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`;

  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendPasswordResetOtpEmail,
};
