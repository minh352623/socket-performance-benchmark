# Socket.io Performance Benchmark: JSON vs Buffer vs Centrifugo

Dự án này là một bản demo để so sánh hiệu suất giữa việc gửi dữ liệu JSON object, Binary Buffer (MsgPack) qua Socket.io (Node.js & Go), và sử dụng Centrifugo (Pub/Sub) để broadcast dữ liệu binary.

## Tính năng
1. **Node.js Backend (3001)**: Gửi JSON & MsgPack Buffer (thủ công).
2. **Go Backend (3002)**: Gửi MsgPack Buffer (dùng magic tag `as_array`) và tích hợp Centrifugo.
3. **Centrifugo (8000)**: Real-time Pub/Sub server, nhận binary từ Go và đẩy xuống Client (Protobuf protocol).
4. **HTTP Caching**: Demo ETag/304 Not Modified.

---

## Cài đặt và Chạy

### 1. Centrifugo (Pub/Sub Server)
Sử dụng Docker để chạy Centrifugo.
```bash
docker-compose up -d
```
*Port: 8000. Dashboard tại http://localhost:8000 (password: admin)*

*(Lưu ý: Nếu không dùng Docker, bạn có thể cài binary `centrifugo` và chạy: `centrifugo -c centrifugo/config.json --http_server.port 8000`)*

### 2. Go Backend (High Performance)
```bash
cd backend-go
go mod tidy
go run main.go
```
*Port: 3002*

### 3. Node.js Backend (Standard)
```bash
cd backend
npm install
node server.js
```
*Port: 3001*

### 4. Frontend (Benchmark Client)
```bash
cd frontend
npm install
npm run dev
```
*Truy cập: http://localhost:3000*

---

## Hướng dẫn Test Review

### Kịch bản 1: Node.js (JSON vs Buffer)
1. Trên web, đảm bảo đang chọn **"Node.js (3001)"** ở toggle phía trên.
2. Nhấn **"Get JSON Data"**:
   - Quan sát Size (~1.61 MB) và Time.
3. Nhấn **"Get Buffer Data"**:
   - Quan sát Size (~1.00 MB).
   - *Kết luận*: Buffer giảm ~40% dung lượng nhờ nén MsgPack và loại bỏ keys.

### Kịch bản 2: Go Backend & Centrifugo
1. Chuyển toggle sang **"Go (3002)"**.
2. Nhấn **"Get Buffer Data"**:
   - Dữ liệu được gửi trực tiếp từ Go qua Socket.io.
   - Size ~1.37 MB (do dùng magic tag `as_array` tự động, ít tối ưu hơn manual tuple một chút nhưng code gọn).
3. Nhấn **"Get Buffer via Centrifugo (Pub/Sub)"**:
   - Go publish data vào channel Centrifugo.
   - Client nhận data qua WebSocket (Protobuf).
   - Kết quả vẫn là ~1.37 MB Binary, integrity passed.

### Kịch bản 3: HTTP Caching (ETag)
1. Kéo xuống dưới phần **"HTTP Caching Demo"**.
2. Nhấn "Fetch Data" lần đầu: Status 200, Size ~500KB.
3. Nhấn lại lần nữa: Status 304, Size 0 Bytes (check Network Tab).

---

## Technical Notes
- **MessagePack `as_array`**: Kỹ thuật biến object `{id:1, name:"A"}` thành mảng `[1, "A"]` để loại bỏ key names, giảm size đáng kể.
- **Centrifugo Protobuf**: Client được cấu hình `protocol: 'protobuf'` để tối ưu hóa việc truyền nhận binary frame.
