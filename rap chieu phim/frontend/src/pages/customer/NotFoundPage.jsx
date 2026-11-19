import React from 'react';
import { Film, Home, Calendar, ArrowLeft } from 'lucide-react';

/**
 * Cinema-themed 404 Not Found Page
 */
export function NotFoundPage({ onNavigateHome, onNavigateSchedules }) {
  return (
    <div className="min-h-[65vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full glass-panel p-8 sm:p-10 rounded-3xl border border-cinema-700/60 shadow-2xl text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-ruby-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon & 404 badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-cinema-800 to-cinema-700 border border-ruby-500/30 flex items-center justify-center shadow-lg">
            <Film className="w-10 h-10 text-ruby-500 animate-pulse" />
          </div>
          <span className="inline-block px-3 py-1 mt-4 rounded-full bg-ruby-500/10 border border-ruby-500/30 text-ruby-400 font-extrabold text-xs tracking-wider uppercase">
            Mã lỗi 404 • Đường dẫn không tồn tại
          </span>
        </div>

        {/* Content */}
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
          Suất Chiếu Không Tồn Tại
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-8">
          Liên kết hoặc phòng chiếu bạn đang truy cập có thể đã kết thúc, bị đổi phòng hoặc không tồn tại trên hệ thống.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onNavigateHome}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-ruby-600 hover:bg-ruby-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-ruby-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Về Trang Chủ
          </button>
          <button
            onClick={onNavigateSchedules}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cinema-800 hover:bg-cinema-700 text-slate-200 font-semibold text-xs sm:text-sm border border-cinema-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Calendar className="w-4 h-4" />
            Xem Lịch Chiếu
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
