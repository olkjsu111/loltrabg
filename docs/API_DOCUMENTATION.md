# 📡 TÀI LIỆU RESTFUL API - HỆ THỐNG RẠP CHIẾU PHIM NIGHT MOVIE

Tài liệu chuẩn hóa các giao tiếp API giữa Frontend Client và Backend Server của hệ thống Night Movie Cinema.

---

## 🌐 Quy Chuẩn Chung (API Standards)

* **Base URL**: `http://localhost:5000/api` (hoặc domain Production)
* **Format**: `application/json`
* **Xác thực (Authentication)**: Bearer Token trong Header:
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  ```
* **Cấu trúc phản hồi chuẩn (Standard Response Structure)**:
  ```json
  {
    "success": true,
    "message": "Thao tác thành công",
    "data": { ... }
  }
  ```
* **Cấu trúc phản hồi lỗi (Error Response Structure)**:
  ```json
  {
    "success": false,
    "message": "Thông báo mô tả lỗi cụ thể",
    "error_code": "INVALID_CREDENTIALS"
  }
  ```

---

## 🔐 1. Xác Thực & Người Dùng (Auth & Users)

### Đăng nhập (Login)
* **Method**: `POST`
* **Endpoint**: `/api/auth/login`
* **Body**:
  ```json
  {
    "email": "customer@nightmovie.vn",
    "password": "Password123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_01",
        "name": "Nguyễn Văn A",
        "email": "customer@nightmovie.vn",
        "role": "customer"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### Đăng ký tài khoản (Register)
* **Method**: `POST`
* **Endpoint**: `/api/auth/register`
* **Body**:
  ```json
  {
    "name": "Nguyễn Văn B",
    "email": "userb@gmail.com",
    "phone": "0912345678",
    "password": "Password123"
  }
  ```

---

## 🎥 2. Phim & Lịch Chiếu (Movies & Schedules)

### Danh sách phim (Get Movies)
* **Method**: `GET`
* **Endpoint**: `/api/movies?status=now_showing`
* **Query Params**:
  * `status`: `now_showing` (đang chiếu) | `coming_soon` (sắp chiếu)
  * `genre`: Tên thể loại (Hành động, Kinh dị, Hoạt hình...)

### Lịch chiếu theo phim (Get Schedules by Movie)
* **Method**: `GET`
* **Endpoint**: `/api/schedules?movieId={movieId}&date={YYYY-MM-DD}`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "sch_101",
        "movieId": "mov_01",
        "movieTitle": "Avatar 3: The Way of Water",
        "roomId": "room_01",
        "roomName": "Phòng Chiếu 01 (IMAX Laser)",
        "startTime": "2026-11-20T19:30:00Z",
        "endTime": "2026-11-20T22:30:00Z",
        "priceStandard": 95000,
        "priceVip": 125000,
        "priceSweetbox": 240000
      }
    ]
  }
  ```

---

## 🪑 3. Đặt Vé & Khóa Giữ Ghế (Booking & Seat Hold)

### Tải sơ đồ ghế & trạng thái (Get Seat Map)
* **Method**: `GET`
* **Endpoint**: `/api/bookings/seats?scheduleId={scheduleId}`
* **Response (200 OK)**:
  Trả về danh sách tất cả các ghế trong phòng, kèm trạng thái `available`, `held` (đang bị giữ tạm thời), hoặc `booked` (đã thanh toán).

### Khóa giữ ghế tạm thời (Hold Seats - 5 Phút)
* **Method**: `POST`
* **Endpoint**: `/api/bookings/hold-seats`
* **Body**:
  ```json
  {
    "scheduleId": "sch_101",
    "seatIds": ["A1", "A2"],
    "holdSessionId": "sess_89f32b"
  }
  ```
* **Mô tả**: Giữ ghế trong vòng 300 giây. Nếu người dùng không hoàn tất thanh toán, hệ thống ngầm `holdSeatCleanupService` sẽ tự động nhả ghế.

---

## 🍿 4. Bắp Nước & Combo (Concessions)

### Danh mục bắp nước
* **Method**: `GET`
* **Endpoint**: `/api/concessions`
* **Response (200 OK)**:
  Trả về các sản phẩm như Bắp rang bơ, Nước ngọt Pepsi, Bánh Tart trứng, Bim bim khoai tây, Combo Solo, Combo Couple.

---

## 💳 5. Thanh Toán & Webhook (Payment & SePay)

### Khởi tạo đơn hàng thanh toán QR
* **Method**: `POST`
* **Endpoint**: `/api/payment/create-order`
* **Body**:
  ```json
  {
    "scheduleId": "sch_101",
    "seatIds": ["A1", "A2"],
    "concessions": [{ "id": "c1", "quantity": 1 }],
    "paymentMethod": "sepay_qr"
  }
  ```
* **Response**: Trả về `orderId`, mã `transferCode`, tài khoản ngân hàng và mã `qrUrl` VietQR.

### Webhook SePay (Nhận thông báo chuyển khoản tự động)
* **Method**: `POST`
* **Endpoint**: `/api/sepay/webhook`
* **Headers**: `x-api-key: <SEPAY_SECRET_KEY>`
* **Mô tả**: Tự động xác thực số tiền, mã chuyển khoản, đổi trạng thái đơn sang `PAID` và xuất vé QR.
