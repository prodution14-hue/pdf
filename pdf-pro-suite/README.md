# PDF Studio Pro (v2.5) — Trình Biên Tập, Chuyển Đổi PDF & Image Studio

> **Phiên bản nâng cấp toàn diện từ trang web mẫu [nguyenmailinhit.netlify.app](https://nguyenmailinhit.netlify.app/)**  
> Thiết kế theo tiêu chuẩn UI/UX hiện đại (Linear/Apple SaaS Style), responsive 100% trên mọi thiết bị và vận hành **100% Client-side (Offline)** trên trình duyệt, không gửi bất kỳ dữ liệu nào lên server.

---

## 🌟 1. Điểm Nâng Cấp Vượt Trội So Với Bản Gốc

| Tính Năng | Bản Gốc (PDF Pro) | Bản Nâng Cấp (PDF Studio Pro v2.5) |
| :--- | :--- | :--- |
| **Giao diện (UI/UX)** | Giao diện tối màu cơ bản, font chữ tiêu chuẩn | Phong cách **Glassmorphism**, đổ bóng đa tầng, typography hiện đại, Bento Grid trực quan |
| **Chế độ Sáng/Tối** | Chỉ có nền tối cố định | **Toggle Dark / Light Mode** mượt mà, lưu trạng thái vào `localStorage` |
| **PDF sang Word (.docx)** | ❌ Chưa có | ✅ Trích xuất layout text, tạo file `.docx` chuẩn Microsoft Word và Google Docs |
| **Word (.docx) sang PDF** | ❌ Chưa có | ✅ Đọc file Word bằng `mammoth.js`, xem trước A4 trực quan và xuất PDF chuẩn 300 DPI |
| **Image Studio & Chèn Ảnh** | ❌ Chưa có | ✅ Phòng xử lý ảnh: Tải nhiều ảnh, xoay, lật, bộ lọc màu, **chèn ảnh/watermark lên trang PDF** bằng `pdf-lib` |
| **Ảnh sang PDF (Images to PDF)**| ❌ Chưa có | ✅ Ghép bộ sưu tập ảnh thành 1 tài liệu PDF hoàn chỉnh |
| **Công cụ PDF Cốt Lõi** | Xem, Ghi chú, Xoay, Tách, Gộp | Toàn bộ tính năng gốc + Quản lý trang dạng lưới (Grid), nén tối ưu, phục hồi nhanh |
| **Bảo mật & Hiệu năng** | 100% Client-side | 100% Client-side trên Web Worker, không phụ thuộc backend |

---

## 📂 2. Cấu Trúc Thư Mục Dự Án

```
pdf-pro-suite/
├── index.html               # Giao diện chính hoàn chỉnh (Responsive, Tailwind, Lucide Icons, Modals)
├── css/
│   └── style.css            # Tùy biến Dark/Light theme, glassmorphism, thanh cuộn, hiệu ứng tương tác
├── js/
│   ├── app.js               # Quản lý ứng dụng, Tab routing, Dark/Light Mode, Toast alerts, Event listeners
│   ├── pdf-manager.js       # Quản lý PDF: Render PDF.js, chỉnh sửa pdf-lib, xoay, xóa, tách, gộp, nén, vẽ
│   ├── converter.js         # Bộ chuyển đổi hai chiều PDF ⇄ Word (.docx) 100% Client-side
│   └── image-studio.js      # Image Studio: Bộ lọc Canvas, dán ảnh vào PDF, ghép nhiều ảnh thành PDF
├── package.json             # Cấu hình dự án & scripts khởi chạy nhanh
└── README.md                # Tài liệu hướng dẫn sử dụng và giải thích kiến trúc kỹ thuật
```

---

## 🚀 3. Hướng Dẫn Cài Đặt & Khởi Chạy

Dự án được xây dựng theo kiến trúc **Module thuần hiện đại kết hợp CDN**, không yêu cầu cấu hình build phức tạp. Bạn có thể chạy theo bất kỳ cách nào dưới đây:

### Cách 1: Khởi chạy bằng Python (Khuyên dùng)
```bash
# Di chuyển vào thư mục dự án
cd C:\Users\VANH\.gemini\antigravity\scratch\pdf-pro-suite

# Khởi chạy server local
python -m http.server 3000
```
Mở trình duyệt tại: `http://localhost:3000`

### Cách 2: Khởi chạy bằng Node.js / npx
```bash
npx serve -l 3000 .
# hoặc
npx live-server --port=3000
```

### Cách 3: Mở trực tiếp (Direct File)
Nhấp đúp chuột trực tiếp vào tệp `index.html` trong trình duyệt Chrome, Edge, Firefox, Safari.

---

## 🧠 4. Giải Thích Cách Hoạt Động Của Các Tính Năng Mới

### A. Chế độ Sáng/Tối (Dark/Light Mode)
- **Cơ chế lưu trạng thái**: Khi người dùng nhấn nút chuyển theme trên Header, hàm `applyTheme()` sẽ:
  1. Thêm/xóa class `.dark` trên thẻ gốc `document.documentElement` (`<html>`).
  2. Lưu chuỗi `'dark'` hoặc `'light'` vào `localStorage.setItem('pdfpro_theme', value)`.
- **Tự động khôi phục**: Khi tải lại trang hoặc truy cập lần sau, hệ thống ưu tiên đọc từ `localStorage`, nếu người dùng chưa đặt thì tự động đọc cài đặt của hệ điều hành thông qua `window.matchMedia('(prefers-color-scheme: dark)')`.

---

### B. Chuyển Đổi PDF sang Word (.docx)
1. **Trích xuất văn bản**: Sử dụng `pdfjsLib.getDocument()` duyệt qua từng trang của file PDF và gọi `page.getTextContent({ normalizeWhitespace: true })`.
2. **Tái tạo cấu trúc dòng & đoạn văn**:
   - Tọa độ `transform[5]` (trục Y) và `transform[4]` (trục X) được sắp xếp từ trên xuống dưới, từ trái sang phải.
   - Các từ nằm trên cùng một độ cao Y được ghép thành dòng (`line`).
   - Phân tích kích thước font chữ: Các dòng có kích thước lớn (> 16pt) hoặc in đậm được tự động gán cấp bậc `Heading 1` hoặc `Heading 2`.
3. **Đóng gói file `.docx`**:
   - Sử dụng thư viện `docx` (tương thích ECMA-376 OpenXML):
   ```javascript
   const doc = new docx.Document({
     sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, ... } } }, children: paragraphs }]
   });
   const blob = await docx.Packer.toBlob(doc);
   ```
   - Chèn `new docx.Paragraph({ children: [new docx.PageBreak()] })` giữa các trang để phân trang giống hệt file PDF gốc.

---

### C. Chuyển Đổi Word (.docx) sang PDF
1. **Phân giải cấu trúc Word**: Sử dụng thư viện `mammoth.js` đọc trực tiếp `ArrayBuffer` của file `.docx` và chuyển thành mã HTML ngữ nghĩa chuẩn (`<h1>`, `<h2>`, `<p>`, `<strong>`, `<table>`).
2. **Xem trước khổ giấy A4 (Live Preview)**: Render cấu trúc HTML bên trong container giả lập trang giấy in A4 (`.a4-paper`) với padding và tỷ lệ chuẩn 210mm x 297mm.
3. **Kết xuất file PDF**: Sử dụng `html2pdf.js` (tích hợp `html2canvas` và `jspdf`):
   ```javascript
   const opt = {
     margin: [10, 10, 10, 10],
     filename: fileName.replace(/\.docx?$/i, '') + '.pdf',
     image: { type: 'jpeg', quality: 0.98 },
     html2canvas: { scale: 2, useCORS: true, letterRendering: true },
     jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
   };
   await html2pdf().set(opt).from(element).save();
   ```

---

### D. Image Studio & Chèn Ảnh Lên Trang PDF
1. **Tải & Xử lý ảnh bằng Canvas**:
   - Sử dụng HTML5 `<canvas>` kết hợp `ctx.filter` để áp dụng theo thời gian thực các bộ lọc: Độ sáng (Brightness), Tương phản (Contrast), Độ bão hòa (Saturation), Đen trắng (Grayscale), Sepia, và Làm mờ (Blur).
   - Biến đổi ma trận (Matrix Transform) để xoay 90°/180° và lật ngang/lật dọc ảnh không làm mất chi tiết gốc.
2. **Giao diện đặt vị trí tương tác (Interactive Stamp Placer)**:
   - Người dùng có thể kéo thả khung viền để chọn tọa độ (X, Y) và kéo nút co giãn ở góc dưới phải để điều chỉnh kích thước (Width, Height).
   - Thanh trượt Opacity cho phép tạo hiệu ứng hình mờ (watermark) hoặc con dấu nổi bật (10% - 100%).
3. **Nhúng trực tiếp vào cấu trúc trang PDF**:
   - Sử dụng `pdf-lib`:
   ```javascript
   const embeddedImage = isPng ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
   const page = pdfDoc.getPage(targetPageIndex);
   page.drawImage(embeddedImage, { x, y, width, height, opacity });
   ```
   - File PDF được tái tạo ngay lập tức và render lại trên màn hình xem trước.
4. **Ghép nhiều ảnh thành PDF (Images to PDF)**:
   - Tạo `PDFDocument.create()`, thêm từng trang khổ A4 và tự động căn giữa bức ảnh với tỷ lệ khung hình chuẩn xác.

---

## 📦 5. Danh Sách Thư Viện Sử Dụng

1. **[PDF.js](https://mozilla.github.io/pdf.js/)** (`v3.11.174`): Trình kết xuất hiển thị PDF chất lượng cao High-DPI của Mozilla.
2. **[pdf-lib](https://pdf-lib.js.org/)** (`v1.17.9`): Tạo, ghép, tách, xoay, nén và nhúng ảnh/chữ vào file PDF client-side.
3. **[docx.js](https://docx.js.org/)** (`v8.5.0`): Thư viện tạo file Microsoft Word `.docx` chuẩn OpenXML trên trình duyệt.
4. **[mammoth.js](https://github.com/mwilliamson/mammoth.js)** (`v1.6.0`): Bộ chuyển đổi định dạng tài liệu Word `.docx` sang HTML ngữ nghĩa.
5. **[html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)** (`v0.10.1`): Chuyển đổi phần tử HTML/CSS thành tài liệu PDF sắc nét.
6. **[Tailwind CSS](https://tailwindcss.com/)**: Framework giao diện hiện đại với hỗ trợ Dark Mode và Responsive.
7. **[Lucide Icons](https://lucide.dev/)**: Bộ biểu tượng SVG hiện đại, tối giản.
