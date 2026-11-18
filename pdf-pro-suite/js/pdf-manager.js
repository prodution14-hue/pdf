/**
 * PDF Studio Pro - Core PDF Management Engine
 * Powered by pdf-lib & pdfjs-dist
 */

window.PDFManager = (function () {
  // Setup PDF.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Internal State
  let state = {
    file: null,
    fileName: 'document.pdf',
    pdfLibDoc: null,
    pdfJsDoc: null,
    rawBytes: null,
    numPages: 0,
    currentPage: 1,
    zoom: 1.0,
    rotation: 0,
    activeTool: 'select', // 'select' | 'draw' | 'highlighter' | 'text' | 'rect' | 'whiteout'
    toolColor: '#ef4444',
    brushSize: 3,
    fontSize: 16,
    isDrawing: false,
    startX: 0,
    startY: 0,
    annotations: {}, // { [pageNumber]: Array<AnnotationItem> }
    history: [],
    historyIndex: -1
  };

  // Canvas elements
  let mainCanvas = null;
  let mainCtx = null;
  let annotCanvas = null;
  let annotCtx = null;
  let stageContainer = null;

  function initElements() {
    mainCanvas = document.getElementById('pdf-render-canvas');
    annotCanvas = document.getElementById('annotation-canvas');
    stageContainer = document.getElementById('pdf-stage-container');

    if (mainCanvas) mainCtx = mainCanvas.getContext('2d');
    if (annotCanvas) {
      annotCtx = annotCanvas.getContext('2d');
      setupAnnotationEvents();
    }
  }

  /**
   * Load PDF from File or ArrayBuffer
   */
  async function loadPdf(fileOrBuffer, fileName = 'document.pdf') {
    try {
      showLoading(true, 'Đang phân tích & mở tệp PDF...');
      let arrayBuffer;
      if (fileOrBuffer instanceof File) {
        state.file = fileOrBuffer;
        state.fileName = fileOrBuffer.name;
        arrayBuffer = await fileOrBuffer.arrayBuffer();
      } else {
        arrayBuffer = fileOrBuffer;
        state.fileName = fileName;
      }

      state.rawBytes = new Uint8Array(arrayBuffer);

      // Load with PDFLib for editing
      state.pdfLibDoc = await PDFLib.PDFDocument.load(state.rawBytes, { ignoreEncryption: true });

      // Load with PDF.js for rendering
      const loadingTask = pdfjsLib.getDocument({ data: state.rawBytes.slice(0) });
      state.pdfJsDoc = await loadingTask.promise;
      state.numPages = state.pdfJsDoc.numPages;
      state.currentPage = 1;
      state.annotations = {};

      // Update UI
      updateDocumentHeader();
      await renderCurrentPage();
      await renderThumbnails();

      // Show workspace, hide landing hero
      toggleWorkspaceView(true);
      window.App.notify('success', `Đã mở thành công tệp: ${state.fileName} (${state.numPages} trang)`);
      return true;
    } catch (err) {
      console.error('Error loading PDF:', err);
      window.App.notify('error', 'Không thể mở file PDF: ' + (err.message || 'Lỗi không xác định'));
      return false;
    } finally {
      showLoading(false);
    }
  }

  /**
   * Render active page onto canvas
   */
  async function renderCurrentPage() {
    if (!state.pdfJsDoc || !mainCanvas || !annotCanvas) return;

    try {
      const page = await state.pdfJsDoc.getPage(state.currentPage);
      const viewport = page.getViewport({ scale: state.zoom, rotation: 0 });

      // Device Pixel Ratio for High-DPI screens
      const dpr = window.devicePixelRatio || 1;
      mainCanvas.width = Math.floor(viewport.width * dpr);
      mainCanvas.height = Math.floor(viewport.height * dpr);
      mainCanvas.style.width = `${Math.floor(viewport.width)}px`;
      mainCanvas.style.height = `${Math.floor(viewport.height)}px`;

      annotCanvas.width = Math.floor(viewport.width * dpr);
      annotCanvas.height = Math.floor(viewport.height * dpr);
      annotCanvas.style.width = `${Math.floor(viewport.width)}px`;
      annotCanvas.style.height = `${Math.floor(viewport.height)}px`;

      mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      annotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Render PDF Page
      const renderContext = {
        canvasContext: mainCtx,
        viewport: viewport
      };
      await page.render(renderContext).promise;

      // Draw saved annotations for this page
      drawAnnotations();

      // Update Pagination UI
      updatePaginationControls();
    } catch (err) {
      console.error('Page render error:', err);
    }
  }

  /**
   * Render page thumbnails for sidebar
   */
  async function renderThumbnails() {
    const thumbContainer = document.getElementById('thumbnail-grid');
    if (!thumbContainer || !state.pdfJsDoc) return;

    thumbContainer.innerHTML = '';

    for (let i = 1; i <= state.numPages; i++) {
      const card = document.createElement('div');
      card.className = `page-thumb-card relative group p-2 rounded-xl border ${
        i === state.currentPage
          ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50/50 dark:bg-red-950/20'
          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
      } cursor-pointer shadow-sm`;

      card.innerHTML = `
        <div class="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-950 aspect-[3/4] flex items-center justify-center">
          <canvas id="thumb-canvas-${i}" class="w-full h-full object-contain pointer-events-none"></canvas>
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
            <button title="Xoay 90°" class="thumb-rotate-btn p-1.5 rounded-md bg-white/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 hover:bg-white text-xs" data-page="${i}">
              <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
            </button>
            <button title="Xóa trang này" class="thumb-delete-btn p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 text-xs" data-page="${i}">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        <div class="mt-2 flex items-center justify-between px-1">
          <span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Trang ${i}</span>
          <span class="text-[10px] text-slate-400 font-mono">${i}/${state.numPages}</span>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          goToPage(i);
        }
      });

      thumbContainer.appendChild(card);

      // Render thumbnail asynchronously
      renderMiniThumb(i, `thumb-canvas-${i}`);
    }

    // Attach actions
    thumbContainer.querySelectorAll('.thumb-rotate-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = parseInt(btn.dataset.page);
        rotatePage(p, 90);
      });
    });

    thumbContainer.querySelectorAll('.thumb-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = parseInt(btn.dataset.page);
        deletePage(p);
      });
    });

    if (window.lucide) lucide.createIcons({ root: thumbContainer });
  }

  async function renderMiniThumb(pageIndex, canvasId) {
    try {
      const page = await state.pdfJsDoc.getPage(pageIndex);
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    } catch (e) {
      console.warn('Mini thumb error for page', pageIndex, e);
    }
  }

  /**
   * Navigation methods
   */
  function goToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > state.numPages) return;
    state.currentPage = pageNumber;
    renderCurrentPage();
    highlightActiveThumbnail();
  }

  function nextPage() {
    if (state.currentPage < state.numPages) {
      goToPage(state.currentPage + 1);
    }
  }

  function prevPage() {
    if (state.currentPage > 1) {
      goToPage(state.currentPage - 1);
    }
  }

  function setZoom(newZoom) {
    state.zoom = Math.min(Math.max(0.3, newZoom), 3.0);
    renderCurrentPage();
    const zoomLabel = document.getElementById('zoom-percentage-text');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function zoomIn() {
    setZoom(state.zoom + 0.15);
  }

  function zoomOut() {
    setZoom(state.zoom - 0.15);
  }

  function fitWidth() {
    if (!stageContainer || !mainCanvas) return;
    const stageWidth = stageContainer.clientWidth - 64;
    if (stageWidth > 0 && mainCanvas.width > 0) {
      setZoom(stageWidth / (mainCanvas.width / (window.devicePixelRatio || 1)));
    }
  }

  function highlightActiveThumbnail() {
    const thumbs = document.querySelectorAll('.page-thumb-card');
    thumbs.forEach((thumb, idx) => {
      if (idx + 1 === state.currentPage) {
        thumb.classList.add('border-red-500', 'ring-2', 'ring-red-500/30', 'bg-red-50/50', 'dark:bg-red-950/20');
        thumb.classList.remove('border-slate-200', 'dark:border-zinc-800');
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        thumb.classList.remove('border-red-500', 'ring-2', 'ring-red-500/30', 'bg-red-50/50', 'dark:bg-red-950/20');
        thumb.classList.add('border-slate-200', 'dark:border-zinc-800');
      }
    });
  }

  /**
   * Document Operations: Rotate, Delete, Reorder, Split, Merge
   */
  async function rotatePage(pageNumber, deg = 90) {
    if (!state.pdfLibDoc) return;
    try {
      showLoading(true, `Đang xoay trang ${pageNumber}...`);
      const pages = state.pdfLibDoc.getPages();
      const page = pages[pageNumber - 1];
      const currentRotation = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((currentRotation + deg) % 360));

      await refreshFromPdfLib();
      window.App.notify('success', `Đã xoay trang ${pageNumber} thêm ${deg}°`);
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi xoay trang: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  async function rotateAllPages(deg = 90) {
    if (!state.pdfLibDoc) return;
    try {
      showLoading(true, `Đang xoay tất cả ${state.numPages} trang...`);
      const pages = state.pdfLibDoc.getPages();
      pages.forEach((page) => {
        const cur = page.getRotation().angle;
        page.setRotation(PDFLib.degrees((cur + deg) % 360));
      });
      await refreshFromPdfLib();
      window.App.notify('success', `Đã xoay toàn bộ tài liệu ${deg}°`);
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi xoay toàn bộ: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  async function deletePage(pageNumber) {
    if (!state.pdfLibDoc) return;
    if (state.numPages <= 1) {
      window.App.notify('warning', 'Tài liệu phải có ít nhất 1 trang!');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn Trang ${pageNumber}?`)) return;

    try {
      showLoading(true, `Đang xóa trang ${pageNumber}...`);
      state.pdfLibDoc.removePage(pageNumber - 1);
      if (state.currentPage >= pageNumber && state.currentPage > 1) {
        state.currentPage--;
      }
      await refreshFromPdfLib();
      window.App.notify('success', `Đã xóa trang ${pageNumber}`);
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi xóa trang: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  async function splitPdf(rangeString) {
    if (!state.pdfLibDoc) {
      window.App.notify('warning', 'Vui lòng mở một tài liệu PDF trước!');
      return;
    }

    try {
      showLoading(true, 'Đang trích xuất và tách trang...');
      const targetIndices = parsePageRanges(rangeString, state.numPages);
      if (targetIndices.length === 0) {
        window.App.notify('warning', 'Khoảng trang không hợp lệ (Ví dụ: 1-3, 5, 7-10)');
        return;
      }

      const newPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(state.pdfLibDoc, targetIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const newBytes = await newPdf.save();
      downloadBlob(newBytes, `split-${state.fileName}`, 'application/pdf');
      window.App.notify('success', `Đã xuất ${targetIndices.length} trang thành công!`);
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi tách PDF: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  async function mergePdfs(files) {
    if (!files || files.length < 2) {
      window.App.notify('warning', 'Vui lòng chọn từ 2 file PDF trở lên để gộp!');
      return;
    }

    try {
      showLoading(true, `Đang gộp ${files.length} tệp PDF...`);
      const mergedPdf = await PDFLib.PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await file.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const indices = doc.getPageIndices();
        const pages = await mergedPdf.copyPages(doc, indices);
        pages.forEach((p) => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      downloadBlob(mergedBytes, 'merged-document.pdf', 'application/pdf');
      window.App.notify('success', `Đã gộp ${files.length} tệp thành công!`);
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi gộp PDF: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  async function compressPdf() {
    if (!state.pdfLibDoc) {
      window.App.notify('warning', 'Chưa có file PDF nào được mở!');
      return;
    }

    try {
      showLoading(true, 'Đang nén và tối ưu hóa PDF...');
      const beforeSize = state.rawBytes.length;

      // Re-save with object streams enabled
      const compressedBytes = await state.pdfLibDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
      });

      const afterSize = compressedBytes.length;
      const reduction = Math.max(0, Math.round((1 - afterSize / beforeSize) * 100));

      downloadBlob(compressedBytes, `compressed-${state.fileName}`, 'application/pdf');
      window.App.notify(
        'success',
        `Đã nén tối ưu! Giảm từ ${(beforeSize / 1024).toFixed(1)} KB xuống ${(afterSize / 1024).toFixed(1)} KB (-${reduction}%)`
      );
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi nén PDF: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  /**
   * Save and Export PDF with flattened annotations
   */
  async function exportPdf() {
    if (!state.pdfLibDoc) return;

    try {
      showLoading(true, 'Đang tổng hợp ghi chú và xuất tệp PDF...');

      // Flatten annotations onto current PDFLib pages if any
      const pageKeys = Object.keys(state.annotations);
      for (const pNum of pageKeys) {
        const pageIdx = parseInt(pNum) - 1;
        const items = state.annotations[pNum];
        if (!items || items.length === 0) continue;

        const targetPage = state.pdfLibDoc.getPage(pageIdx);
        const { width, height } = targetPage.getSize();

        for (const item of items) {
          if (item.type === 'text') {
            targetPage.drawText(item.text, {
              x: item.x * width,
              y: (1 - item.y) * height,
              size: item.size || 14,
              color: hexToRgbPdf(item.color || '#000000')
            });
          } else if (item.type === 'whiteout') {
            targetPage.drawRectangle({
              x: item.x * width,
              y: (1 - item.y - item.h) * height,
              width: item.w * width,
              height: item.h * height,
              color: PDFLib.rgb(1, 1, 1),
              opacity: 1
            });
          }
        }
      }

      const finalBytes = await state.pdfLibDoc.save({ useObjectStreams: true });
      downloadBlob(finalBytes, `edited-${state.fileName}`, 'application/pdf');
      window.App.notify('success', 'Đã tải xuống file PDF chỉnh sửa thành công!');
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi xuất PDF: ' + e.message);
    } finally {
      showLoading(false);
    }
  }

  /**
   * Embed image onto current page using PDFLib
   */
  async function stampImageOntoPage(imageFileOrDataUrl, xPct, yPct, widthPx, heightPx, opacity = 1.0) {
    if (!state.pdfLibDoc) {
      window.App.notify('warning', 'Vui lòng mở file PDF trước khi chèn ảnh!');
      return false;
    }

    try {
      showLoading(true, `Đang chèn ảnh vào Trang ${state.currentPage}...`);
      let imageBytes;
      let isPng = false;

      if (typeof imageFileOrDataUrl === 'string') {
        const res = await fetch(imageFileOrDataUrl);
        imageBytes = await res.arrayBuffer();
        isPng = imageFileOrDataUrl.includes('png') || imageFileOrDataUrl.startsWith('data:image/png');
      } else {
        imageBytes = await imageFileOrDataUrl.arrayBuffer();
        isPng = imageFileOrDataUrl.type.includes('png');
      }

      let embeddedImage;
      try {
        if (isPng) {
          embeddedImage = await state.pdfLibDoc.embedPng(imageBytes);
        } else {
          embeddedImage = await state.pdfLibDoc.embedJpg(imageBytes);
        }
      } catch (embErr) {
        // Fallback try PNG if JPG fails or vice versa
        try {
          embeddedImage = await state.pdfLibDoc.embedPng(imageBytes);
        } catch (inner) {
          embeddedImage = await state.pdfLibDoc.embedJpg(imageBytes);
        }
      }

      const page = state.pdfLibDoc.getPage(state.currentPage - 1);
      const { width: pWidth, height: pHeight } = page.getSize();

      const stampW = (widthPx / (mainCanvas.width / (window.devicePixelRatio || 1))) * pWidth;
      const stampH = (heightPx / (mainCanvas.height / (window.devicePixelRatio || 1))) * pHeight;
      const posX = xPct * pWidth;
      const posY = (1 - yPct) * pHeight - stampH;

      page.drawImage(embeddedImage, {
        x: Math.max(0, posX),
        y: Math.max(0, posY),
        width: stampW,
        height: stampH,
        opacity: opacity
      });

      await refreshFromPdfLib();
      window.App.notify('success', `Đã dán ảnh thành công lên Trang ${state.currentPage}!`);
      return true;
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi khi chèn ảnh vào PDF: ' + e.message);
      return false;
    } finally {
      showLoading(false);
    }
  }

  /**
   * Helper: Reload PDF.js from updated PDFLib doc
   */
  async function refreshFromPdfLib() {
    state.rawBytes = await state.pdfLibDoc.save();
    const loadingTask = pdfjsLib.getDocument({ data: state.rawBytes.slice(0) });
    state.pdfJsDoc = await loadingTask.promise;
    state.numPages = state.pdfJsDoc.numPages;
    if (state.currentPage > state.numPages) state.currentPage = state.numPages;

    await renderCurrentPage();
    await renderThumbnails();
    updateDocumentHeader();
  }

  /**
   * Annotation Canvas Logic (Pen, Text, Highlighter, Eraser)
   */
  function setupAnnotationEvents() {
    annotCanvas.addEventListener('mousedown', onMouseDown);
    annotCanvas.addEventListener('mousemove', onMouseMove);
    annotCanvas.addEventListener('mouseup', onMouseUp);
    annotCanvas.addEventListener('mouseleave', onMouseUp);

    // Touch support for mobile & tablet
    annotCanvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      annotCanvas.dispatchEvent(mouseEvent);
    });

    annotCanvas.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      annotCanvas.dispatchEvent(mouseEvent);
    });

    annotCanvas.addEventListener('touchend', () => {
      const mouseEvent = new MouseEvent('mouseup', {});
      annotCanvas.dispatchEvent(mouseEvent);
    });
  }

  function getCanvasCoords(e) {
    const rect = annotCanvas.getBoundingClientRect();
    const scaleX = annotCanvas.width / (rect.width * (window.devicePixelRatio || 1));
    const scaleY = annotCanvas.height / (rect.height * (window.devicePixelRatio || 1));
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pctX: (e.clientX - rect.left) / rect.width,
      pctY: (e.clientY - rect.top) / rect.height
    };
  }

  function onMouseDown(e) {
    if (state.activeTool === 'select') return;
    const coords = getCanvasCoords(e);
    state.isDrawing = true;
    state.startX = coords.x;
    state.startY = coords.y;

    if (state.activeTool === 'text') {
      const text = prompt('Nhập văn bản cần chèn vào trang:', 'Văn bản mẫu');
      if (text && text.trim()) {
        addAnnotation({
          type: 'text',
          text: text.trim(),
          x: coords.pctX,
          y: coords.pctY,
          color: state.toolColor,
          size: state.fontSize
        });
        drawAnnotations();
      }
      state.isDrawing = false;
      return;
    }

    if (state.activeTool === 'draw' || state.activeTool === 'highlighter') {
      annotCtx.beginPath();
      annotCtx.moveTo(coords.x, coords.y);
      annotCtx.strokeStyle = state.activeTool === 'highlighter' ? hexToRgba(state.toolColor, 0.4) : state.toolColor;
      annotCtx.lineWidth = state.activeTool === 'highlighter' ? state.brushSize * 4 : state.brushSize;
      annotCtx.lineCap = 'round';
      annotCtx.lineJoin = 'round';
    }
  }

  function onMouseMove(e) {
    if (!state.isDrawing) return;
    const coords = getCanvasCoords(e);

    if (state.activeTool === 'draw' || state.activeTool === 'highlighter') {
      annotCtx.lineTo(coords.x, coords.y);
      annotCtx.stroke();
    } else if (state.activeTool === 'whiteout' || state.activeTool === 'rect') {
      // Re-draw annotations + temporary rectangle preview
      drawAnnotations();
      annotCtx.fillStyle = state.activeTool === 'whiteout' ? '#ffffff' : hexToRgba(state.toolColor, 0.2);
      annotCtx.strokeStyle = state.toolColor;
      annotCtx.lineWidth = 1.5;
      const w = coords.x - state.startX;
      const h = coords.y - state.startY;
      annotCtx.fillRect(state.startX, state.startY, w, h);
      annotCtx.strokeRect(state.startX, state.startY, w, h);
    }
  }

  function onMouseUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    const coords = getCanvasCoords(e);

    if (state.activeTool === 'whiteout' || state.activeTool === 'rect') {
      const rect = annotCanvas.getBoundingClientRect();
      const minX = Math.min(state.startX, coords.x) / (rect.width * (window.devicePixelRatio || 1));
      const minY = Math.min(state.startY, coords.y) / (rect.height * (window.devicePixelRatio || 1));
      const widthPct = Math.abs(coords.x - state.startX) / (rect.width * (window.devicePixelRatio || 1));
      const heightPct = Math.abs(coords.y - state.startY) / (rect.height * (window.devicePixelRatio || 1));

      if (widthPct > 0.01 && heightPct > 0.01) {
        addAnnotation({
          type: state.activeTool,
          x: minX,
          y: minY,
          w: widthPct,
          h: heightPct,
          color: state.toolColor
        });
        drawAnnotations();
      }
    }
  }

  function addAnnotation(item) {
    if (!state.annotations[state.currentPage]) {
      state.annotations[state.currentPage] = [];
    }
    state.annotations[state.currentPage].push(item);
  }

  function drawAnnotations() {
    const list = state.annotations[state.currentPage] || [];
    annotCtx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);

    const rect = annotCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    for (const item of list) {
      if (item.type === 'text') {
        annotCtx.font = `600 ${item.size || 16}px 'DM Sans', sans-serif`;
        annotCtx.fillStyle = item.color || '#000000';
        annotCtx.fillText(item.text, item.x * w, item.y * h);
      } else if (item.type === 'whiteout') {
        annotCtx.fillStyle = '#ffffff';
        annotCtx.fillRect(item.x * w, item.y * h, item.w * w, item.h * h);
        annotCtx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
        annotCtx.strokeRect(item.x * w, item.y * h, item.w * w, item.h * h);
      } else if (item.type === 'rect') {
        annotCtx.strokeStyle = item.color || '#ef4444';
        annotCtx.lineWidth = 2;
        annotCtx.strokeRect(item.x * w, item.y * h, item.w * w, item.h * h);
      }
    }
  }

  function clearPageAnnotations() {
    state.annotations[state.currentPage] = [];
    annotCtx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
    window.App.notify('info', `Đã xóa các ghi chú trên Trang ${state.currentPage}`);
  }

  /**
   * Helper Utilities
   */
  function parsePageRanges(str, max) {
    const indices = [];
    const parts = (str || '').split(',').map((s) => s.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n));
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.max(1, start); p <= Math.min(max, end); p++) {
            if (!indices.includes(p - 1)) indices.push(p - 1);
          }
        }
      } else {
        const p = parseInt(part);
        if (!isNaN(p) && p >= 1 && p <= max) {
          if (!indices.includes(p - 1)) indices.push(p - 1);
        }
      }
    }
    return indices.sort((a, b) => a - b);
  }

  function hexToRgba(hex, alpha = 1) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  function hexToRgbPdf(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    return PDFLib.rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
  }

  function downloadBlob(data, fileName, mimeType) {
    const blob = new Blob([data], { type: mimeType });
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

  function updatePaginationControls() {
    const curEl = document.getElementById('current-page-num');
    const totEl = document.getElementById('total-pages-num');
    const pageInput = document.getElementById('page-jump-input');
    if (curEl) curEl.textContent = state.currentPage;
    if (totEl) totEl.textContent = state.numPages;
    if (pageInput) {
      pageInput.value = state.currentPage;
      pageInput.max = state.numPages;
    }
  }

  function updateDocumentHeader() {
    const titleEl = document.getElementById('active-doc-title');
    const badgeEl = document.getElementById('active-doc-badge');
    if (titleEl) titleEl.textContent = state.fileName;
    if (badgeEl) badgeEl.textContent = `${state.numPages} Trang • ${(state.rawBytes.length / (1024 * 1024)).toFixed(2)} MB`;
  }

  function toggleWorkspaceView(showWorkspace) {
    const landing = document.getElementById('landing-hero-section');
    const workspace = document.getElementById('main-workspace');
    if (showWorkspace) {
      if (landing) landing.classList.add('hidden');
      if (workspace) workspace.classList.remove('hidden');
    } else {
      if (landing) landing.classList.remove('hidden');
      if (workspace) workspace.classList.add('hidden');
    }
  }

  function showLoading(show, message = 'Đang xử lý...') {
    const loader = document.getElementById('global-loading-modal');
    const msgEl = document.getElementById('global-loading-msg');
    if (!loader) return;
    if (show) {
      if (msgEl) msgEl.textContent = message;
      loader.classList.remove('hidden');
    } else {
      loader.classList.add('hidden');
    }
  }

  // Public Interface
  return {
    init: initElements,
    loadPdf,
    renderCurrentPage,
    goToPage,
    nextPage,
    prevPage,
    setZoom,
    zoomIn,
    zoomOut,
    fitWidth,
    rotatePage,
    rotateAllPages,
    deletePage,
    splitPdf,
    mergePdfs,
    compressPdf,
    exportPdf,
    stampImageOntoPage,
    clearPageAnnotations,
    setActiveTool: (tool) => (state.activeTool = tool),
    setToolColor: (color) => (state.toolColor = color),
    setBrushSize: (size) => (state.brushSize = size),
    getState: () => ({ ...state })
  };
})();
