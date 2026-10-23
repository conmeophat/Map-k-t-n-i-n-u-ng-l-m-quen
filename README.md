# 🍜 Foodie Map Việt Nam — Bản đồ ẩm thực & Shopping

Trang web cho phép mọi người **đi, khám phá và review** chất lượng đồ ăn cũng như giá tiền tại các địa điểm ẩm thực & shopping khắp Việt Nam.

## ✨ Tính năng
- 🗺️ **Bản đồ tương tác** (Leaflet + OpenStreetMap) hiển thị các địa điểm
- ⭐ **Review từ cộng đồng**: đánh giá sao, chất lượng đồ ăn, giá tiền hợp lý
- 🍲 **Nhiều danh mục**: Ẩm thực, Shopping, Café, Giải trí
- 🔍 **Tìm kiếm & lọc** theo loại địa điểm, **đầy đủ 63 tỉnh thành Việt Nam** và **khoảng giá tiền** (từ X đến Y)
- 🗺️ **63 tỉnh thành** — dropdown đầy đủ tất cả tỉnh/thành, đánh dấu ● nơi có địa điểm
- ➕ **Thêm địa điểm mới** — nhấn vào bản đồ để lấy tọa độ tự động
- 💾 **Backend Node.js (Express) + SQLite** — dữ liệu review được lưu trữ chung cho mọi người

## 🚀 Cách chạy

```bash
npm install
npm start
```

Sau đó mở trình duyệt: **http://localhost:3000**

## 📁 Cấu trúc
- `backend/server.js` — Server Express + SQLite API
- `public/index.html` — Giao diện chính
- `public/css/style.css` — Kiểu dáng
- `public/js/app.js` — Logic frontend

## 🔌 API
- `GET /api/places` — danh sách địa điểm (lọc theo category, city, q)
- `GET /api/places/:id` — chi tiết + review
- `POST /api/places` — thêm địa điểm
- `POST /api/places/:id/reviews` — thêm review


## 🏖️ Dữ liệu đặc biệt
- **Quy Nhơn (Bình Định)**: 62 quán ăn được cập nhật đầy đủ (bánh hỏi cháo lòng, bún cá, bánh xèo tôm nhảy, hải sản, chè, cafe...)

## 📍 Về độ chính xác địa chỉ (cập nhật 23/10/2026)

- **Tên đường** tại Quy Nhơn được xác minh chính xác (Nguyễn Huệ, Xuân Diệu, Diên Hồng, Tăng Bạc Hổ, Phan Bội Châu, Bạch Đằng...).
- **Tên phường cũ** (Lê Lợi, Lê Hồng Phong, Lý Thường Kiệt, Ngô Mây...) đã bị loại bỏ khỏi địa chỉ vì Quy Nhơn đã **sáp nhập 6 phường thành 2 phường** (Trần Phú, Thị Nại) từ 1/12/2024, và hiện vận hành mô hình chính quyền địa phương 2 cấp với "phường Quy Nhơn".
- Địa chỉ được chuẩn hóa theo định dạng: `số nhà + tên đường, Quy Nhơn, Bình Định` (chính xác, không dùng tên phường đã cũ).
- Tọa độ (lat/lng) là ước lượng theo địa chỉ, có thể lệch nhẹ vài chục mét so với vị trí thực tế.
- Nếu bạn phát hiện địa chỉ nào sai, hãy sửa trực tiếp bằng nút "Thêm địa điểm mới" hoặc báo để cập nhật.

## 💰 Bộ lọc giá (API)
- `GET /api/places?price_min=50000&price_max=100000` — lọc quán có giá trong khoảng từ 50k đến 100k
- `price_min` = giá từ (quán có món mức giá cao nhất ≥ giá trị)
- `price_max` = giá đến (quán có món mức giá thấp nhất ≤ giá trị)
- Thêm `🗑️ Xóa quán`: `DELETE /api/places/:id` (xóa cả review liên quan)

## 👥 Tìm bạn đi cùng

- Người dùng đăng ký bằng **họ tên đầy đủ, tuổi, SĐT, mục tiêu, giờ & ngày đi**.
- **Danh sách công khai** chỉ hiện **TÊN (không họ)** + tuổi + mục tiêu + giờ + ngày — **giấu hoàn toàn họ và số điện thoại**.
- **Tự động match** khi 2 người có cùng *mục tiêu + giờ + ngày*.
- Chỉ khi đã match, **2 người mới thấy họ tên đầy đủ và SĐT của nhau**.

### API
- `POST /api/partner` — đăng ký tìm bạn (body: full_name, age, phone, destination, depart_time, depart_date)
- `GET /api/partner` — danh sách công khai (chỉ name không họ + age)
- `GET /api/partner/:id/matches` — xem thông tin đầy đủ của người đã match
- `DELETE /api/partner/:id` — hủy đăng ký (nút "🚫 Hủy đăng ký tìm bạn" trong modal)

### Format "Giờ đi" (bắt buộc)
- Nhập dạng: `giờ + h + phút` (24h), ví dụ `20h45`, `08h30`, `7h05`
- Không dùng dạng `20:45` hay `8:30 PM`

### Format "Mục tiêu muốn đến" (bắt buộc)
- Phải nhập đúng dạng: `Tên địa điểm (Số nhà Tên đường)`
- Ví dụ hợp lệ: `Cafe G-Life (111 Phan Đình Phùng)`
- Các dạng khác sẽ bị từ chối (cả client & server đều validate)
