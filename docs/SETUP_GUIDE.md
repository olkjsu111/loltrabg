# 🚀 HƯỚNG DẪN CÀI ĐẶT VÀ KHỞI CHẠY HỆ THỐNG (DEVELOPMENT GUIDE)

Tài liệu này hướng dẫn chi tiết cách thiết lập môi trường và khởi chạy dự án **Night Movie Cinema** trên môi trường cục bộ (Local Development) hoặc trên máy chủ.

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

* **Node.js**: Phiên bản `>= 18.16.0` (Khuyến nghị bản LTS 20.x)
* **npm**: Phiên bản `>= 9.x` (đi kèm Node.js)
* **Cơ sở dữ liệu**: PostgreSQL 15+ hoặc tài khoản [Supabase](https://supabase.com)
* **Git**: Phiên bản mới nhất

---

## 📥 1. Tải Mã Nguồn

```bash
git clone https://github.com/olkjsu111/loltrabg.git
cd loltrabg
```

---

## ⚙️ 2. Cấu Hình Cơ Sở Dữ Liệu (PostgreSQL / Supabase)

1. Tạo một cơ sở dữ liệu mới trên PostgreSQL hoặc trên Supabase Dashboard.
2. Mở trình quản lý SQL (hoặc Supabase SQL Editor) và thực thi script khởi tạo cấu trúc bảng:
   * Chạy file: `rap chieu phim/supabase_schema.sql` (nếu dùng Supabase)
   * Hoặc chạy file: `rap chieu phim/cinema_management.sql` (nếu dùng PostgreSQL thuần)

---

## 🖥️ 3. Cài Đặt Và Khởi Chạy Backend

1. Di chuyển vào thư mục backend:
   ```bash
   cd "rap chieu phim/backend"
   ```

2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

3. Cấu hình biến môi trường:
   Tạo file `.env` từ file mẫu `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Cập nhật các thông số kết nối:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/cinema_db
   # Hoặc nếu dùng Supabase Connection String:
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your_super_secret_jwt_key
   ```

4. Khởi chạy Backend Server:
   ```bash
   npm run dev
   # Hoặc: node server.js
   ```
   *Backend sẽ lắng nghe tại: `http://localhost:5000`*

---

## 🎨 4. Cài Đặt Và Khởi Chạy Frontend

1. Mở một cửa sổ Terminal mới và di chuyển vào thư mục frontend:
   ```bash
   cd "rap chieu phim/frontend"
   ```

2. Cài đặt các gói thư viện:
   ```bash
   npm install
   ```

3. Cấu hình file `.env`:
   Tạo file `.env` trong thư mục `frontend`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. Khởi chạy môi trường phát triển (Dev Server):
   ```bash
   npm run dev
   ```
   *Truy cập ứng dụng tại: `http://localhost:5173`*

---

## 🔑 5. Tài Khoản Đăng Nhập Mặc Định

| Vai trò (Role) | Email | Mật khẩu mặc định | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin / Manager)** | `admin@nightmovie.vn` | `Admin@123` | Toàn quyền cấu hình, KDM, báo cáo doanh thu |
| **Nhân viên soát vé (Staff)** | `staff@nightmovie.vn` | `Staff@123` | Quét QR vé vào rạp, hỗ trợ khách hàng |
| **Kỹ thuật viên (Technician)** | `tech@nightmovie.vn` | `Tech@123` | Quản lý thiết bị máy chiếu, bảo trì phòng chiếu |
| **Khách hàng (Customer)** | `customer@nightmovie.vn` | `Cust@123` | Đặt vé xem phim, gọi bắp nước, xem vé cá nhân |

---

## 🛠️ 6. Khắc Phục Sự Cố Thường Gặp (Troubleshooting)

* **Lỗi Port 5000 bị chiếm dụng**:
  Kiểm tra ứng dụng đang dùng port 5000 và đổi sang port khác trong file `.env` (ví dụ `PORT=5001`).
* **Lỗi CORS khi gọi API**:
  Đảm bảo `server.js` trong backend đã cấu hình `origin: '*'` hoặc đúng domain của frontend Vite (`http://localhost:5173`).
