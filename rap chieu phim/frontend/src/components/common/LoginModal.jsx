import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { X, Lock, User, Mail, Phone, KeyRound, CheckCircle, Eye, EyeOff } from 'lucide-react';

function GoogleLogoIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.21 7.21 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.99 3.09c.95-2.85 3.6-4.97 6.72-4.97Z"
      />
    </svg>
  );
}

const DEMO_ACCOUNTS = [
  {
    name: 'Elon Musk',
    role: 'Admin',
    username: 'admin',
    password: 'password123',
    nameColor: 'text-ruby-400',
    hoverBorder: 'hover:border-ruby-500/60',
  },
  {
    name: 'Mark Zuckerberg',
    role: 'Manager',
    username: 'manager1',
    password: 'password123',
    nameColor: 'text-amber-400',
    hoverBorder: 'hover:border-amber-500/60',
  },
  {
    name: 'Steve Jobs',
    role: 'Staff',
    username: 'staff1',
    password: 'password123',
    nameColor: 'text-blue-400',
    hoverBorder: 'hover:border-blue-500/60',
  },
  {
    name: 'Bill Gate',
    role: 'Technician',
    username: 'tech1',
    password: 'password123',
    nameColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/60',
  },
];

export function LoginModal({ isOpen, onClose }) {
  const { login, register, googleLogin, loading } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Nhập email/username -> 2: Nhập OTP 6 số & mật khẩu mới
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [googleClientId, setGoogleClientId] = useState(
    () => (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  );
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    forgotIdentifier: '',
    forgotOtp: '',
    forgotNewPassword: '',
    forgotConfirmPassword: '',
  });

  // Cơ chế 1: Thoát Modal bằng phím tắt ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Cơ chế 2: Khóa cuộn trang nền khi mở Modal và dọn dẹp sạch khi đóng / unmount
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow || 'unset';
      };
    }
  }, [isOpen]);

  // Lấy Google Client ID từ backend nếu chưa có trong biến môi trường build-time
  useEffect(() => {
    if (!isOpen || googleClientId) return;
    let cancelled = false;
    api
      .getGoogleConfig()
      .then((res) => {
        if (!cancelled && res?.success && res?.clientId) {
          setGoogleClientId(res.clientId);
        }
      })
      .catch(() => {
        // Không chặn luồng đăng nhập thường nếu endpoint chưa có config
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, googleClientId]);

  const handleGoogleCredentialResponse = useCallback(
    async (response) => {
      if (!response?.credential) {
        setErrorMsg('Không nhận được mã xác thực từ Google. Vui lòng thử lại.');
        return;
      }
      setErrorMsg('');
      setSuccessMsg('');
      const res = await googleLogin(response.credential);
      if (res?.success) {
        setSuccessMsg(`Chào mừng ${res.user?.name || res.user?.username}!`);
        setTimeout(() => onClose?.(), 800);
      } else {
        setErrorMsg(res?.message || 'Đăng nhập Google thất bại.');
      }
    },
    [googleLogin, onClose]
  );

  // Tải Google Identity Services SDK và render nút đăng nhập Google chính thức
  useEffect(() => {
    if (!isOpen || isForgotMode || !googleClientId) {
      setGoogleReady(false);
      return;
    }

    let cancelled = false;

    const initGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });
        googleBtnRef.current.innerHTML = '';
        const containerWidth = Math.min(Math.max(googleBtnRef.current.offsetWidth || 380, 260), 400);
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: isRegisterMode ? 'signup_with' : 'signin_with',
          locale: 'vi',
          width: containerWidth,
        });
        // Đảm bảo iframe Google không bị nền trắng do lệch color-scheme trong chế độ tối
        const iframe = googleBtnRef.current.querySelector('iframe');
        if (iframe) {
          iframe.style.colorScheme = 'light';
          iframe.style.backgroundColor = 'transparent';
        }
        setGoogleReady(true);
      } catch (err) {
        console.warn('Không thể khởi tạo nút Google Sign-In:', err);
        setGoogleReady(false);
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleButton();
    } else {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.addEventListener('load', initGoogleButton);
        return () => {
          cancelled = true;
          existingScript.removeEventListener('load', initGoogleButton);
        };
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogleButton;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, isForgotMode, isRegisterMode, googleClientId, handleGoogleCredentialResponse]);

  // Đếm ngược thời gian gửi lại OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  if (!isOpen) return null;

  const resetForgotState = () => {
    setForgotStep(1);
    setForgotMaskedEmail('');
    setOtpCooldown(0);
    setFormData((prev) => ({
      ...prev,
      forgotOtp: '',
      forgotNewPassword: '',
      forgotConfirmPassword: '',
    }));
  };

  const handleSendOtp = async () => {
    const identifier = formData.forgotIdentifier.trim();
    if (!identifier) {
      setErrorMsg('Vui lòng nhập email hoặc tên đăng nhập của bạn.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setForgotLoading(true);
    try {
      const res = await api.sendForgotPasswordOtp({ identifier });
      if (res.success) {
        setForgotMaskedEmail(res.maskedEmail || identifier);
        setForgotStep(2);
        setOtpCooldown(res.cooldownSeconds || 60);
        setSuccessMsg(res.message);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setFormData((prev) => ({ ...prev, username: u, password: p }));
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isForgotMode) {
      if (forgotStep === 1) {
        await handleSendOtp();
        return;
      }

      if (!/^\d{6}$/.test(formData.forgotOtp.trim())) {
        setErrorMsg('Mã OTP phải gồm đúng 6 chữ số.');
        return;
      }
      if (formData.forgotNewPassword.length < 6) {
        setErrorMsg('Mật khẩu mới phải có tối thiểu 6 ký tự.');
        return;
      }
      if (formData.forgotNewPassword !== formData.forgotConfirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không khớp.');
        return;
      }

      setForgotLoading(true);
      try {
        const res = await api.forgotPassword({
          identifier: formData.forgotIdentifier.trim(),
          otp: formData.forgotOtp.trim(),
          newPassword: formData.forgotNewPassword,
        });
        if (res.success) {
          setSuccessMsg(res.message);
          const nextPwd = formData.forgotNewPassword;
          setTimeout(() => {
            setIsForgotMode(false);
            resetForgotState();
            setFormData((prev) => ({ ...prev, password: nextPwd }));
          }, 1500);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Lỗi xác thực OTP hoặc đổi mật khẩu.');
      } finally {
        setForgotLoading(false);
      }
      return;
    }

    if (isRegisterMode) {
      const res = await register(formData);
      if (res.success) {
        setSuccessMsg('Đăng ký thành công!');
        setTimeout(() => onClose(), 800);
      } else {
        setErrorMsg(res.message);
      }
    } else {
      const res = await login(formData.username, formData.password);
      if (res.success) {
        setSuccessMsg(`Chào mừng ${res.user.name || res.user.username}!`);
        setTimeout(() => onClose(), 800);
      } else {
        setErrorMsg(res.message);
      }
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => {
        // Cơ chế 3: Click Outside (Bấm ra ngoài vùng nền tối để đóng Modal)
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="relative w-full max-w-[500px] max-h-[88vh] flex flex-col overflow-y-auto rounded-2xl bg-[#12151f] border border-white/10 shadow-2xl p-6 sm:p-8 animate-scale-up"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderRadius: '16px',
          background: '#12151f',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút Đóng (X) cố định ở góc trên bên phải, kích thước 36x36px */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-black/75 hover:bg-ruby-600 text-white backdrop-blur-md transition-all flex items-center justify-center border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
          title="Đóng (phím ESC)"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-ruby-600/20 text-ruby-400 mb-3 border border-ruby-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">
            {isForgotMode ? 'Khôi Phục Mật Khẩu' : isRegisterMode ? 'Đăng Ký Khách Hàng' : 'Đăng Nhập Hệ Thống'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isForgotMode
              ? forgotStep === 1
                ? 'Nhập email hoặc tên đăng nhập để nhận mã OTP 6 chữ số'
                : `Nhập mã OTP 6 số đã gửi tới ${forgotMaskedEmail} và đặt mật khẩu mới`
              : 'Chào mừng bạn đến với Rạp chiếu phim Night Movie'}
          </p>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-ruby-950/80 border border-ruby-600/50 text-ruby-200 text-xs flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isForgotMode ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email hoặc Tên đăng nhập</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={forgotStep === 2}
                    value={formData.forgotIdentifier}
                    onChange={(e) => setFormData({ ...formData, forgotIdentifier: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500 disabled:opacity-60"
                    placeholder="email@gmail.com hoặc tên đăng nhập"
                  />
                </div>
              </div>

              {forgotStep === 2 && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">Mã xác nhận OTP (6 số)</label>
                      <button
                        type="button"
                        disabled={otpCooldown > 0 || forgotLoading}
                        onClick={handleSendOtp}
                        className="text-[11px] text-ruby-400 hover:text-ruby-300 font-semibold disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {otpCooldown > 0 ? `Gửi lại sau ${otpCooldown}s` : 'Gửi lại mã OTP'}
                      </button>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={formData.forgotOtp}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          forgotOtp: e.target.value.replace(/\D/g, '').slice(0, 6),
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-center font-mono text-lg tracking-[0.45em] focus:outline-none focus:border-ruby-500"
                      placeholder="••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu mới</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={formData.forgotNewPassword}
                        onChange={(e) => setFormData({ ...formData, forgotNewPassword: e.target.value })}
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500"
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={formData.forgotConfirmPassword}
                        onChange={(e) => setFormData({ ...formData, forgotConfirmPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500"
                        placeholder="Nhập lại mật khẩu mới"
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tên đăng nhập</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500 focus:ring-1 focus:ring-ruby-500"
                    placeholder="Nhập username"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Mật khẩu</label>
                  {!isRegisterMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] text-ruby-400 hover:text-ruby-300 font-semibold"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500 focus:ring-1 focus:ring-ruby-500"
                    placeholder="Nhập password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isRegisterMode && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-cinema-900 border border-cinema-700 text-white text-sm focus:outline-none focus:border-ruby-500"
                        placeholder="0901234567"
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading || forgotLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-ruby-600 via-ruby-700 to-rose-700 hover:from-ruby-500 hover:to-rose-600 text-white font-bold text-sm shadow-glow-red transition-all mt-4 disabled:opacity-50"
          >
            {loading || forgotLoading
              ? 'Đang xử lý...'
              : isForgotMode
                ? forgotStep === 1
                  ? 'Gửi mã OTP (6 số)'
                  : 'Xác nhận OTP & Đổi mật khẩu'
                : isRegisterMode
                  ? 'Đăng Ký Ngay'
                  : 'Đăng Nhập'}
          </button>
        </form>

        {/* Google Sign-In Section */}
        {!isForgotMode && (
          <div className="mt-4">
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-cinema-700/70 w-full" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-slate-400 bg-[#12151f] shrink-0">
                hoặc
              </span>
              <div className="border-t border-cinema-700/70 w-full" />
            </div>

            {googleClientId ? (
              <div className="flex flex-col items-center">
                <div
                  ref={googleBtnRef}
                  className="w-full flex justify-center min-h-[42px] overflow-hidden rounded-full"
                  style={{ colorScheme: 'light' }}
                />
                {!googleReady && (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Đang tải nút đăng nhập Google...
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setErrorMsg(
                    'Chức năng đăng nhập Google chưa được cấu hình GOOGLE_CLIENT_ID trên máy chủ Vercel.'
                  )
                }
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm border border-slate-200 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <GoogleLogoIcon className="w-4 h-4" />
                <span>{isRegisterMode ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google'}</span>
              </button>
            )}
          </div>
        )}

        {/* Demo Accounts Quick Fill */}
        {!isRegisterMode && !isForgotMode && (
          <div className="mt-6 pt-4 border-t border-cinema-700/60">
            <div className="text-[11px] font-bold text-gold-400 uppercase tracking-wider mb-2">
              Tài khoản mẫu (Bấm để điền nhanh):
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleQuickFill(acc.username, acc.password)}
                  className={`p-2.5 rounded-xl bg-cinema-900 hover:bg-cinema-850 ${acc.hoverBorder} border border-cinema-700/60 text-left transition-all cursor-pointer min-h-[56px] flex flex-col justify-center`}
                >
                  <div className={`font-bold text-xs truncate ${acc.nameColor}`}>{acc.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                    {acc.role} • {acc.username}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Mode */}
        <div className="mt-4 text-center text-xs text-slate-400">
          {isForgotMode ? (
            <div className="flex items-center justify-center gap-4">
              {forgotStep === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    resetForgotState();
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-slate-300 hover:text-white hover:underline font-semibold"
                >
                  Đổi email khác
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(false);
                  resetForgotState();
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-ruby-400 hover:underline font-bold"
              >
                ← Quay lại Đăng nhập
              </button>
            </div>
          ) : isRegisterMode ? (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => setIsRegisterMode(false)}
                className="text-ruby-400 hover:underline font-bold"
              >
                Đăng nhập ngay
              </button>
            </span>
          ) : (
            <span>
              Khách hàng mới?{' '}
              <button
                type="button"
                onClick={() => setIsRegisterMode(true)}
                className="text-ruby-400 hover:underline font-bold"
              >
                Tạo tài khoản đặt vé
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
