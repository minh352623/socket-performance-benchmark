# Socket.io Performance Benchmark: JSON vs Buffer

Dự án này là một bản demo đơn giản để so sánh hiệu suất (kích thước gói tin và tốc độ xử lý) giữa việc gửi dữ liệu dưới dạng JSON object thuần túy và dạng Binary Buffer (sử dụng MessagePack) qua Socket.io.

## Tại sao có dự án này?

Trong các ứng dụng Real-time, băng thông và tốc độ phản hồi là yếu tố sống còn. Việc lựa chọn định dạng dữ liệu có thể ảnh hưởng lớn đến hiệu suất. Dự án này giúp minh chứng trực quan sự khác biệt giữa hai phương pháp phổ biến.

## Cài đặt và Chạy

### Yêu cầu
- Node.js (v18 trở lên)
- Npm

### 1. Backend
Backend chạy server Socket.io, tạo bộ dữ liệu giả lập (5000 items) và lắng nghe các request.

```bash
cd backend
npm install
node server.js
```
Server sẽ chạy tại `http://localhost:3001`.

### 2. Frontend
Frontend là ứng dụng Next.js dùng để hiển thị và benchmark.

```bash
cd frontend
npm install
npm run dev
```
Truy cập `http://localhost:3000` trên trình duyệt.

## Hướng dẫn sử dụng

1. Mở trang web.
2. Nhấn nút **"Get JSON Data"**: Frontend sẽ nhận dữ liệu dạng JSON.
3. Nhấn nút **"Get Buffer Data"**: Frontend sẽ nhận dữ liệu dạng Buffer (MsgPack) và giải mã lại.
4. So sánh kết quả hiển thị trên màn hình.

---

## Tại sao Buffer (MessagePack) lại nhanh và nhẹ hơn JSON?

Trong thử nghiệm này, bạn sẽ thấy dữ liệu dạng Buffer thường nhỏ hơn JSON khoảng 15-30% (tùy thuộc vào cấu trúc dữ liệu). Dưới đây là lý do kỹ thuật:

### 1. Định dạng Nhị phân (Binary) vs Văn bản (Text)
- **JSON**: Là định dạng văn bản (text based). Nó cần sử dụng các ký tự phân cách như dấu ngoặc nhọn `{}`, ngoặc vuông `[]`, dấu phẩy `,`, dấu hai chấm `:` và dấu ngoặc kép `""` cho mọi key và string. Những ký tự này chiếm dung lượng đáng kể.
- **Buffer (MsgPack)**: Là định dạng nhị phân. Nó loại bỏ hoàn toàn các ký tự phân cách thừa thãi. Ví dụ: một mảng 5 phần tử trong MsgPack chỉ cần 1 byte header để khai báo "đây là mảng 5 phần tử", thay vì tốn các dấu `[` `]` và `,`.

### 2. Mã hóa Số (Integers)
- **JSON**: Lưu số dưới dạng chuỗi ký tự. Ví dụ số `12345` mất 5 bytes (5 ký tự ASCII).
- **MsgPack**: Lưu số dưới dạng các byte thực (variable length integers). Số `12345` có thể chỉ mất 2 hoặc 3 bytes để biểu diễn. 

### 3. Tối ưu Header và Metadata
- MsgPack tối ưu hóa việc lưu trữ độ dài của chuỗi và các kiểu dữ liệu khác, giúp metadata gọn nhẹ hơn nhiều so với cú pháp rườm rà của JSON.

### Kết luận
Sử dụng Binary Buffer (như MessagePack, Protobuf) đặc biệt hiệu quả khi:
- Dữ liệu lớn và phức tạp.
- Cần tiết kiệm băng thông mạng (Network Bandwidth).
- Ứng dụng yêu cầu độ trễ thấp (Low Latency), ví dụ: Game, IoT, High-frequency trading.

JSON vẫn tốt cho sự đơn giản, dễ đọc (human-readable) và debug, nhưng Buffer là lựa chọn tối ưu cho hiệu suất.
