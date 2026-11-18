/**
 * PDF Studio Pro - Document Format Converter (100% Client-Side)
 * Powered by pdfjs-dist, docx.js, mammoth.js & html2pdf.js
 */

window.DocConverter = (function () {
  let docxHtmlPreview = null;
  let currentDocxFile = null;

  /**
   * Convert PDF to Word (.docx)
   * Extracts layout & text from PDF and packages into authentic .docx format
   */
  async function convertPdfToWord(fileOrBytes, customName = 'converted-document.docx') {
    if (!window.pdfjsLib) {
      window.App.notify('error', 'Thư viện PDF.js chưa sẵn sàng!');
      return;
    }
    if (!window.docx) {
      window.App.notify('error', 'Thư viện docx.js chưa sẵn sàng!');
      return;
    }

    try {
      showConvertProgress(true, 'Đang đọc và phân tích cấu trúc PDF...');
      let arrayBuffer;
      let originalName = customName;

      if (fileOrBytes instanceof File) {
        originalName = fileOrBytes.name.replace(/\.pdf$/i, '') + '.docx';
        arrayBuffer = await fileOrBytes.arrayBuffer();
      } else {
        arrayBuffer = fileOrBytes;
      }

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const paragraphs = [];

      // Add Document Title Header in Word
      paragraphs.push(
        new docx.Paragraph({
          text: `TÀI LIỆU CHUYỂN ĐỔI TỪ PDF`,
          heading: docx.HeadingLevel.TITLE,
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 300 }
        })
      );

      paragraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: `Chuyển đổi tự động bởi PDF Studio Pro • Tổng cộng ${totalPages} trang • Thời gian: ${new Date().toLocaleString('vi-VN')}`,
              italics: true,
              size: 18,
              color: '71717A'
            })
          ],
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      );

      // Process each page
      for (let p = 1; p <= totalPages; p++) {
        showConvertProgress(true, `Đang xử lý Trang ${p} / ${totalPages}...`);
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent({ normalizeWhitespace: true });

        // Add Page separator notice
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: `--- TRANG ${p} ---`,
                bold: true,
                size: 20,
                color: 'EF4444'
              })
            ],
            spacing: { before: 200, after: 150 }
          })
        );

        if (textContent.items.length === 0) {
          paragraphs.push(
            new docx.Paragraph({
              children: [new docx.TextRun({ text: '(Trang này không có văn bản hoặc là trang scan/ảnh)', italics: true })],
              spacing: { after: 120 }
            })
          );
        } else {
          // Group text items by Y coordinate to form lines & paragraphs
          const lines = groupTextIntoLines(textContent.items);

          for (const line of lines) {
            const lineText = line.text.trim();
            if (!lineText) continue;

            const isHeading = line.fontSize > 16 || (line.fontSize > 13 && line.isBold);

            if (isHeading) {
              paragraphs.push(
                new docx.Paragraph({
                  text: lineText,
                  heading: line.fontSize > 16 ? docx.HeadingLevel.HEADING_1 : docx.HeadingLevel.HEADING_2,
                  spacing: { before: 240, after: 120 }
                })
              );
            } else {
              paragraphs.push(
                new docx.Paragraph({
                  children: [
                    new docx.TextRun({
                      text: lineText,
                      size: Math.round(line.fontSize * 2) || 22,
                      bold: line.isBold
                    })
                  ],
                  spacing: { after: 100 },
                  alignment: docx.AlignmentType.LEFT
                })
              );
            }
          }
        }

        // Add page break if not last page
        if (p < totalPages) {
          paragraphs.push(
            new docx.Paragraph({
              children: [new docx.PageBreak()]
            })
          );
        }
      }

      showConvertProgress(true, 'Đang tạo tệp Microsoft Word (.docx)...');

      // Create docx Document
      const doc = new docx.Document({
        creator: 'PDF Studio Pro',
        title: originalName,
        description: 'Chuyển đổi từ PDF sang Word hoàn toàn trên trình duyệt',
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440, // 1 inch
                  right: 1440,
                  bottom: 1440,
                  left: 1440
                }
              }
            },
            children: paragraphs
          }
        ]
      });

      // Export Blob
      const blob = await docx.Packer.toBlob(doc);
      downloadBlob(blob, originalName);

      window.App.notify('success', `Đã chuyển đổi thành công sang file Word: ${originalName}!`);
    } catch (err) {
      console.error('PDF to Word Error:', err);
      window.App.notify('error', 'Lỗi chuyển đổi PDF sang Word: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      showConvertProgress(false);
    }
  }

  /**
   * Group PDF.js text items into structured lines
   */
  function groupTextIntoLines(items) {
    // Sort primarily by Y descending (PDF coords start from bottom), then X ascending
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    const lines = [];
    let currentLine = null;

    for (const item of sorted) {
      const y = item.transform[5];
      const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]) || 11;
      const isBold = (item.fontName && /bold/i.test(item.fontName)) || false;

      if (!currentLine || Math.abs(currentLine.y - y) > 4) {
        if (currentLine) lines.push(currentLine);
        currentLine = {
          y: y,
          fontSize: fontSize,
          isBold: isBold,
          text: item.str
        };
      } else {
        // Same line: append with space if needed
        currentLine.text += (currentLine.text.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
        if (fontSize > currentLine.fontSize) currentLine.fontSize = fontSize;
        if (isBold) currentLine.isBold = true;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * Read Word (.docx) and render interactive HTML preview
   */
  async function previewWordDoc(file) {
    if (!window.mammoth) {
      window.App.notify('error', 'Thư viện Mammoth.js chưa được nạp!');
      return;
    }

    try {
      showConvertProgress(true, 'Đang đọc và phân tích cấu trúc tệp Word (.docx)...');
      currentDocxFile = file;
      const arrayBuffer = await file.arrayBuffer();

      const options = {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ]
      };

      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, options);
      docxHtmlPreview = result.value;

      const previewContainer = document.getElementById('word-to-pdf-preview-box');
      const actionArea = document.getElementById('word-convert-action-area');
      const fileMeta = document.getElementById('word-file-meta-tag');

      if (previewContainer) {
        previewContainer.innerHTML = `
          <div class="a4-paper prose max-w-none text-slate-800 dark:text-zinc-900 shadow-xl rounded-sm">
            ${docxHtmlPreview || '<p class="text-slate-400 italic">Tài liệu không có nội dung văn bản hiển thị.</p>'}
          </div>
        `;
      }

      if (fileMeta) {
        fileMeta.textContent = `${file.name} • ${(file.size / 1024).toFixed(1)} KB`;
      }

      if (actionArea) {
        actionArea.classList.remove('hidden');
      }

      window.App.notify('success', 'Đã phân tích tệp Word thành công! Bạn có thể xem trước hoặc nhấn xuất PDF.');
    } catch (err) {
      console.error('Word Parse Error:', err);
      window.App.notify('error', 'Không thể đọc tệp Word: ' + err.message);
    } finally {
      showConvertProgress(false);
    }
  }

  /**
   * Export Word preview to High-Quality PDF
   */
  async function exportWordToPdf() {
    const previewPaper = document.querySelector('#word-to-pdf-preview-box .a4-paper');
    if (!previewPaper || !window.html2pdf) {
      window.App.notify('warning', 'Chưa có tài liệu Word nào được nạp để xuất!');
      return;
    }

    try {
      showConvertProgress(true, 'Đang kết xuất tài liệu sang PDF chuẩn A4...');
      const targetName = currentDocxFile
        ? currentDocxFile.name.replace(/\.docx?$/i, '') + '.pdf'
        : 'converted-document.pdf';

      const opt = {
        margin: [10, 10, 10, 10], // 10mm margins
        filename: targetName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(previewPaper).save();
      window.App.notify('success', `Đã xuất file PDF thành công: ${targetName}!`);
    } catch (err) {
      console.error('Word to PDF Error:', err);
      window.App.notify('error', 'Lỗi xuất PDF: ' + err.message);
    } finally {
      showConvertProgress(false);
    }
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  function showConvertProgress(show, message = 'Đang chuyển đổi định dạng...') {
    const bar = document.getElementById('converter-progress-container');
    const msg = document.getElementById('converter-progress-msg');
    if (!bar) return;
    if (show) {
      if (msg) msg.textContent = message;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  return {
    convertPdfToWord,
    previewWordDoc,
    exportWordToPdf
  };
})();
