const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { sendPasswordResetOtpEmail } = require('../services/mailService');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const OTP_EXPIRE_MINUTES = 5;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
let otpTableEnsured = false;

/**
 * Đăng nhập hệ thống (Hỗ trợ cả 5 Actors)
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
      });
    }

    const users = await db.query(
      `SELECT u.id, u.username, u.password, u.role_id, r.name AS role, u.status,
              c.id AS customer_id, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              e.id AS employee_id, e.name AS employee_name, e.email AS employee_email, e.phone AS employee_phone, e.position, e.department
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN customers c ON c.user_id = u.id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.username = ?`,
      [username]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    const user = users[0];

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.',
      });
    }

    // Kiểm tra mật khẩu (hỗ trợ cả mật khẩu băm bcrypt và password mẫu password123 / admin123)
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }

    // Cho phép tiện ích demo: nếu password là 'password123' hoặc 'admin123'
    if (!isMatch && (password === 'password123' || password === 'admin123')) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      roleId: user.role_id,
      role: user.role,
      customerId: user.customer_id,
      employeeId: user.employee_id,
      name: user.employee_name || user.customer_name || user.username,
      email: user.employee_email || user.customer_email || '',
      phone: user.employee_phone || user.customer_phone || '',
      position: user.position,
      department: user.department,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: `Đăng nhập thành công với vai trò ${user.role.toUpperCase()}`,
      token,
      user: tokenPayload,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Đăng ký tài khoản Khách hàng mới
 */
async function register(req, res, next) {
  try {
    const { username, password, name, email, phone } = req.body;

    if (!username || !password || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.',
      });
    }

    // Kiểm tra trùng username hoặc email
    const existingUsers = await db.query(
      `SELECT id FROM users WHERE username = ?`,
      [username]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.',
      });
    }

    const existingEmails = await db.query(
      `SELECT id FROM customers WHERE email = ?`,
      [email]
    );
    if (existingEmails.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được đăng ký. Vui lòng sử dụng email khác.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.withTransaction(async (conn) => {
      // Role ID 5 = customer
      const [userResult] = await conn.query(
        `INSERT INTO users (username, password, role_id, status) VALUES (?, ?, 5, 'active')`,
        [username, hashedPassword]
      );
      const userId = userResult.insertId;

      const [customerResult] = await conn.query(
        `INSERT INTO customers (user_id, name, email, phone, membership_level) VALUES (?, ?, ?, ?, 'standard')`,
        [userId, name, email, phone]
      );
      const customerId = customerResult.insertId;

      return { userId, customerId };
    });

    const tokenPayload = {
      id: result.userId,
      username,
      roleId: 5,
      role: 'customer',
      customerId: result.customerId,
      name,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản khách hàng thành công!',
      token,
      user: tokenPayload,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lấy thông tin user hiện tại
 */
async function getMe(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Switch Role nhanh phục vụ Demo / Chấm điểm Đồ án (1-Click Switch Role)
 */
async function fastSwitchRole(req, res, next) {
  try {
    // STT 03: Chặn switch-role trong môi trường production hoặc khi ENABLE_DEMO_TOOLS !== 'true'
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_TOOLS !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Tính năng chuyển đổi vai trò nhanh (switch-role) đã bị vô hiệu hóa vì lý do bảo mật. Chỉ cho phép khi NODE_ENV !== "production" và ENABLE_DEMO_TOOLS=true.',
      });
    }

    const { targetRole } = req.body; // 'admin', 'manager', 'staff', 'technician', 'customer'
    
    let defaultUsername = 'admin';
    if (targetRole === 'manager') defaultUsername = 'manager1';
    else if (targetRole === 'staff') defaultUsername = 'staff1';
    else if (targetRole === 'technician') defaultUsername = 'tech1';
    else if (targetRole === 'customer') defaultUsername = 'customer1';

    const users = await db.query(
      `SELECT u.id, u.username, u.role_id, r.name AS role, u.status,
              c.id AS customer_id, c.name AS customer_name,
              e.id AS employee_id, e.name AS employee_name, e.position, e.department
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN customers c ON c.user_id = u.id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.username = ? OR r.name = ?
       LIMIT 1`,
      [defaultUsername, targetRole]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy tài khoản mẫu cho role: ${targetRole}`,
      });
    }

    const user = users[0];
    const tokenPayload = {
      id: user.id,
      username: user.username,
      roleId: user.role_id,
      role: user.role,
      customerId: user.customer_id,
      employeeId: user.employee_id,
      name: user.employee_name || user.customer_name || user.username,
      email: user.employee_email || user.customer_email || '',
      phone: user.employee_phone || user.customer_phone || '',
      position: user.position,
      department: user.department,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: `Đã chuyển đổi sang vai trò: ${user.role.toUpperCase()}`,
      token,
      user: tokenPayload,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cập nhật thông tin cá nhân (Profile & Đổi mật khẩu)
 */
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, email, phone, currentPassword, newPassword } = req.body;

    const users = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    const user = users[0];

    // Xử lý đổi mật khẩu nếu có
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu hiện tại để đổi mật khẩu.' });
      }

      let isMatch = false;
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(currentPassword, user.password);
      } else {
        isMatch = (currentPassword === user.password);
      }
      if (!isMatch && (currentPassword === 'password123' || currentPassword === 'admin123')) {
        isMatch = true;
      }

      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await db.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, userId]);
    }

    // Cập nhật thông tin chi tiết vào bảng tương ứng
    if (req.user.role === 'customer' || req.user.customerId) {
      const custId = req.user.customerId || userId;
      await db.query(
        `UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone) WHERE id = ? OR user_id = ?`,
        [name, email, phone, custId, userId]
      );
    } else {
      const empId = req.user.employeeId || userId;
      await db.query(
        `UPDATE employees SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone) WHERE id = ? OR user_id = ?`,
        [name, email, phone, empId, userId]
      );
    }

    const updatedUserPayload = {
      ...req.user,
      name: name || req.user.name,
      email: email || req.user.email,
      phone: phone || req.user.phone,
    };
    delete updatedUserPayload.iat;
    delete updatedUserPayload.exp;

    const token = jwt.sign(updatedUserPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công!',
      user: updatedUserPayload,
      token,
    });
  } catch (error) {
    next(error);
  }
}

async function ensurePasswordResetOtpTable() {
  if (otpTableEnsured) return;
  const isPg = typeof db.getIsSupabase === 'function' && db.getIsSupabase();
  if (isPg) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(150) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email VARCHAR(150) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_password_reset_otps_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
  }
  otpTableEnsured = true;
}

function hashOtp(userId, otpCode) {
  return crypto
    .createHmac('sha256', JWT_SECRET || 'night_movie_otp_secret')
    .update(`${userId}:${otpCode}`)
    .digest('hex');
}

function maskEmail(email) {
  const [local = '', domain = ''] = String(email).split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

async function findAccountByIdentifier(identifier) {
  const clean = String(identifier || '').trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();

  const rows = await db.query(
    `SELECT u.id, u.username, u.status,
            COALESCE(c.email, e.email) AS email,
            COALESCE(c.name, e.name, u.username) AS display_name
     FROM users u
     LEFT JOIN customers c ON c.user_id = u.id
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE LOWER(u.username) = ? OR LOWER(c.email) = ? OR LOWER(e.email) = ?
     LIMIT 1`,
    [lower, lower, lower]
  );

  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Bước 1 Quên mật khẩu: Gửi mã OTP 6 số tới email đã đăng ký
 */
async function sendForgotPasswordOtp(req, res, next) {
  try {
    const identifier = req.body?.identifier || req.body?.email || req.body?.username;

    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email hoặc tên đăng nhập của bạn.',
      });
    }

    const account = await findAccountByIdentifier(identifier);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản khớp với email hoặc tên đăng nhập đã nhập.',
      });
    }

    if (account.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản này đang bị khóa hoặc tạm ngưng hoạt động.',
      });
    }

    if (!account.email) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản này chưa có email liên kết để nhận mã OTP.',
      });
    }

    await ensurePasswordResetOtpTable();

    // Chống gửi spam OTP liên tục (chờ 60 giây giữa 2 lần gửi)
    const recentOtps = await db.query(
      `SELECT id, created_at FROM password_reset_otps
       WHERE user_id = ? AND used_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [account.id]
    );
    if (recentOtps && recentOtps.length > 0) {
      const lastCreated = new Date(recentOtps[0].created_at).getTime();
      const elapsedSec = Math.floor((Date.now() - lastCreated) / 1000);
      if (Number.isFinite(elapsedSec) && elapsedSec >= 0 && elapsedSec < OTP_COOLDOWN_SECONDS) {
        return res.status(429).json({
          success: false,
          message: `Vui lòng chờ ${OTP_COOLDOWN_SECONDS - elapsedSec} giây trước khi yêu cầu gửi lại mã OTP.`,
        });
      }
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpHash = hashOtp(account.id, otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // Gửi email trước khi lưu (hoặc vô hiệu hóa OTP cũ khi gửi thành công)
    await sendPasswordResetOtpEmail({
      to: account.email,
      recipientName: account.display_name,
      otpCode,
      expiresMinutes: OTP_EXPIRE_MINUTES,
    });

    await db.query(
      `UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL`,
      [account.id]
    );
    await db.query(
      `INSERT INTO password_reset_otps (user_id, email, otp_hash, attempts, expires_at) VALUES (?, ?, ?, 0, ?)`,
      [account.id, account.email, otpHash, expiresAt]
    );

    return res.status(200).json({
      success: true,
      message: `Mã OTP gồm 6 chữ số đã được gửi tới email ${maskEmail(account.email)}. Mã có hiệu lực trong ${OTP_EXPIRE_MINUTES} phút.`,
      maskedEmail: maskEmail(account.email),
      expiresInSeconds: OTP_EXPIRE_MINUTES * 60,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * Bước 2 Quên mật khẩu: Xác thực mã OTP 6 số và đổi mật khẩu mới
 */
async function forgotPassword(req, res, next) {
  try {
    const identifier = req.body?.identifier || req.body?.email || req.body?.username;
    const otp = String(req.body?.otp || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ email/tên đăng nhập, mã OTP 6 số và mật khẩu mới.',
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP phải gồm đúng 6 chữ số.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
      });
    }

    const account = await findAccountByIdentifier(identifier);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với thông tin đã cung cấp.',
      });
    }

    await ensurePasswordResetOtpTable();

    const otpRows = await db.query(
      `SELECT id, otp_hash, attempts, expires_at
       FROM password_reset_otps
       WHERE user_id = ? AND used_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [account.id]
    );

    if (!otpRows || otpRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Chưa có mã OTP hợp lệ. Vui lòng bấm gửi mã OTP mới.',
      });
    }

    const otpRecord = otpRows[0];

    if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
      await db.query(`UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [otpRecord.id]);
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi mã mới.',
      });
    }

    if (Number(otpRecord.attempts) >= OTP_MAX_ATTEMPTS) {
      await db.query(`UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [otpRecord.id]);
      return res.status(429).json({
        success: false,
        message: 'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng gửi lại mã OTP mới.',
      });
    }

    const expectedHash = hashOtp(account.id, otp);
    const isValid =
      otpRecord.otp_hash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(otpRecord.otp_hash), Buffer.from(expectedHash));

    if (!isValid) {
      const nextAttempts = Number(otpRecord.attempts) + 1;
      await db.query(`UPDATE password_reset_otps SET attempts = ? WHERE id = ?`, [nextAttempts, otpRecord.id]);
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
      return res.status(400).json({
        success: false,
        message:
          remaining > 0
            ? `Mã OTP không chính xác. Bạn còn ${remaining} lần thử.`
            : 'Mã OTP không chính xác và đã hết lượt thử. Vui lòng yêu cầu gửi lại mã mới.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.withTransaction(async (conn) => {
      await conn.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, account.id]);
      await conn.query(`UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [otpRecord.id]);
    });

    return res.status(200).json({
      success: true,
      message: 'Xác thực OTP thành công! Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Trả về cấu hình Google OAuth công khai cho Frontend (chỉ Client ID)
 */
async function getGoogleConfig(req, res) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  return res.status(200).json({
    success: true,
    enabled: Boolean(clientId),
    clientId,
  });
}

/**
 * Đăng nhập / Tự động đăng ký bằng Google (Google Identity Services ID Token)
 */
async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body || {};
    const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();

    if (!googleClientId) {
      return res.status(503).json({
        success: false,
        message: 'Máy chủ chưa cấu hình GOOGLE_CLIENT_ID để đăng nhập bằng Google.',
      });
    }

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã xác thực Google (credential).',
      });
    }

    // Xác thực Google ID Token trực tiếp với Google OAuth2 tokeninfo endpoint
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!verifyRes.ok) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.',
      });
    }

    const googleUser = await verifyRes.json();

    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    const isEmailVerified =
      googleUser.email_verified === true || googleUser.email_verified === 'true';
    const expMs = Number(googleUser.exp) * 1000;

    if (
      googleUser.aud !== googleClientId ||
      !validIssuers.includes(googleUser.iss) ||
      !googleUser.email ||
      !isEmailVerified ||
      !Number.isFinite(expMs) ||
      expMs <= Date.now()
    ) {
      return res.status(401).json({
        success: false,
        message: 'Token Google không khớp ứng dụng hoặc email chưa được xác minh.',
      });
    }

    const email = String(googleUser.email).trim().toLowerCase();
    const displayName = String(googleUser.name || email.split('@')[0] || 'Khách hàng Google').trim();
    const avatar = googleUser.picture || null;

    // 1. Tìm tài khoản đã có theo email (khách hàng hoặc nhân viên)
    const existingUsers = await db.query(
      `SELECT u.id, u.username, u.role_id, r.name AS role, u.status,
              c.id AS customer_id, c.name AS customer_name, c.email AS customer_email,
              e.id AS employee_id, e.name AS employee_name, e.position, e.department
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN customers c ON c.user_id = u.id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE LOWER(c.email) = ? OR LOWER(e.email) = ?
       LIMIT 1`,
      [email, email]
    );

    let tokenPayload;

    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.',
        });
      }

      tokenPayload = {
        id: user.id,
        username: user.username,
        roleId: user.role_id,
        role: user.role,
        customerId: user.customer_id,
        employeeId: user.employee_id,
        name: user.employee_name || user.customer_name || displayName,
        email,
        avatar,
        position: user.position,
        department: user.department,
        authProvider: 'google',
      };
    } else {
      // 2. Chưa có tài khoản -> Tự động tạo tài khoản Khách hàng (role_id = 5)
      const baseUsername =
        email
          .split('@')[0]
          .replace(/[^a-z0-9_]/gi, '_')
          .toLowerCase()
          .slice(0, 40) || 'google_user';

      let finalUsername = baseUsername;
      const usernameCheck = await db.query(
        `SELECT id FROM users WHERE username = ?`,
        [finalUsername]
      );
      if (usernameCheck && usernameCheck.length > 0) {
        finalUsername = `${baseUsername}_${crypto.randomBytes(3).toString('hex')}`;
      }

      const randomPassword = crypto.randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const created = await db.withTransaction(async (conn) => {
        const [userResult] = await conn.query(
          `INSERT INTO users (username, password, role_id, status) VALUES (?, ?, 5, 'active')`,
          [finalUsername, hashedPassword]
        );
        const userId = userResult.insertId;

        const [customerResult] = await conn.query(
          `INSERT INTO customers (user_id, name, email, phone, membership_level) VALUES (?, ?, ?, ?, 'standard')`,
          [userId, displayName, email, '']
        );
        const customerId = customerResult.insertId;

        return { userId, customerId };
      });

      tokenPayload = {
        id: created.userId,
        username: finalUsername,
        roleId: 5,
        role: 'customer',
        customerId: created.customerId,
        employeeId: null,
        name: displayName,
        email,
        avatar,
        authProvider: 'google',
      };
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: `Đăng nhập Google thành công! Chào mừng ${tokenPayload.name}.`,
      token,
      user: tokenPayload,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  register,
  getGoogleConfig,
  googleLogin,
  getMe,
  fastSwitchRole,
  updateProfile,
  sendForgotPasswordOtp,
  forgotPassword,
};
