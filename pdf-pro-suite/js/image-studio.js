/**
 * PDF Studio Pro - Image Studio & PDF Image Integration
 * Upload, preview, filter, edit, convert to PDF, and stamp onto PDF pages
 */

window.ImageStudio = (function () {
  let images = []; // Array of { id, file, dataUrl, name, width, height, size }
  let activeImageIndex = 0;

  // Filter & Transform State
  let transform = {
    rotation: 0,
    flipH: 1,
    flipV: 1,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    sepia: 0,
    invert: 0,
    blur: 0
  };

  // Stamp placement state
  let stampState = {
    xPct: 0.25,
    yPct: 0.25,
    widthPx: 180,
    heightPx: 120,
    opacity: 1.0,
    isDragging: false,
    isResizing: false,
    dragStartX: 0,
    dragStartY: 0
  };

  /**
   * Initialize Image Studio elements & listeners
   */
  function init() {
    setupUploadHandlers();
    setupFilterSliders();
    setupStampPlacer();
  }

  function setupUploadHandlers() {
    const input = document.getElementById('image-upload-input');
    const dropzone = document.getElementById('image-dropzone');

    if (input) {
      input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFiles(Array.from(e.target.files));
        }
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-red-500', 'bg-red-50/20');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-red-500', 'bg-red-50/20');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-red-500', 'bg-red-50/20');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFiles(Array.from(e.dataTransfer.files));
        }
      });
    }
  }

  async function handleFiles(fileList) {
    const validImages = fileList.filter((f) => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      window.App.notify('warning', 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP, SVG)!');
      return;
    }

    for (const file of validImages) {
      const dataUrl = await readFileAsDataUrl(file);
      const dims = await getImageDimensions(dataUrl);

      images.push({
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        file,
        dataUrl,
        name: file.name,
        width: dims.width,
        height: dims.height,
        size: (file.size / 1024).toFixed(1) + ' KB'
      });
    }

    activeImageIndex = images.length - 1;
    resetFilters();
    renderGallery();
    renderActiveImage();
    updateStampBox();

    // Show studio stage
    const emptyState = document.getElementById('image-studio-empty');
    const mainView = document.getElementById('image-studio-main');
    if (emptyState) emptyState.classList.add('hidden');
    if (mainView) mainView.classList.remove('hidden');

    window.App.notify('success', `Đã tải lên ${validImages.length} ảnh vào Image Studio!`);
  }

  function renderGallery() {
    const list = document.getElementById('image-gallery-list');
    const countEl = document.getElementById('image-count-tag');
    if (!list) return;

    if (countEl) countEl.textContent = `${images.length} Ảnh`;
    list.innerHTML = '';

    images.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = `p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
        idx === activeImageIndex
          ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-500'
          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
      }`;

      item.innerHTML = `
        <img src="${img.dataUrl}" class="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-zinc-700 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate">${img.name}</p>
          <p class="text-[10px] text-slate-400 font-mono">${img.width}x${img.height} • ${img.size}</p>
        </div>
        <button class="remove-img-btn p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" data-idx="${idx}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-img-btn')) {
          activeImageIndex = idx;
          resetFilters();
          renderGallery();
          renderActiveImage();
          updateStampBox();
        }
      });

      list.appendChild(item);
    });

    list.querySelectorAll('.remove-img-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeIdx = parseInt(btn.dataset.idx);
        images.splice(removeIdx, 1);
        if (activeImageIndex >= images.length) {
          activeImageIndex = Math.max(0, images.length - 1);
        }
        if (images.length === 0) {
          const emptyState = document.getElementById('image-studio-empty');
          const mainView = document.getElementById('image-studio-main');
          if (emptyState) emptyState.classList.remove('hidden');
          if (mainView) mainView.classList.add('hidden');
        } else {
          renderGallery();
          renderActiveImage();
        }
      });
    });

    if (window.lucide) lucide.createIcons({ root: list });
  }

  /**
   * Render active image on editor canvas with all CSS filters & transforms
   */
  function renderActiveImage() {
    if (images.length === 0 || !images[activeImageIndex]) return;

    const imgData = images[activeImageIndex];
    const previewCanvas = document.getElementById('image-editor-canvas');
    if (!previewCanvas) return;

    const ctx = previewCanvas.getContext('2d');
    const img = new Image();
    img.src = imgData.dataUrl;

    img.onload = () => {
      // Handle rotation dimensions
      const isRotated90or270 = Math.abs(transform.rotation % 180) === 90;
      const targetW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
      const targetH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

      previewCanvas.width = targetW;
      previewCanvas.height = targetH;

      ctx.save();
      // Apply filters
      ctx.filter = `
        brightness(${transform.brightness}%)
        contrast(${transform.contrast}%)
        saturate(${transform.saturation}%)
        grayscale(${transform.grayscale}%)
        sepia(${transform.sepia}%)
        invert(${transform.invert}%)
        blur(${transform.blur}px)
      `.trim();

      // Transform center
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.flipH, transform.flipV);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      // Update stamp preview overlay image as well
      const stampImg = document.getElementById('stamp-preview-img');
      if (stampImg) {
        stampImg.src = previewCanvas.toDataURL('image/png');
      }
    };
  }

  function setupFilterSliders() {
    const filters = ['brightness', 'contrast', 'saturation', 'grayscale', 'sepia', 'invert', 'blur'];
    filters.forEach((f) => {
      const slider = document.getElementById(`filter-${f}`);
      const valLabel = document.getElementById(`filter-${f}-val`);
      if (slider) {
        slider.addEventListener('input', (e) => {
          transform[f] = parseFloat(e.target.value);
          if (valLabel) valLabel.textContent = e.target.value + (f === 'blur' ? 'px' : '%');
          renderActiveImage();
        });
      }
    });

    // Rotation & Flip Buttons
    const rotateLeft = document.getElementById('btn-rotate-left');
    const rotateRight = document.getElementById('btn-rotate-right');
    const flipH = document.getElementById('btn-flip-h');
    const flipV = document.getElementById('btn-flip-v');
    const resetBtn = document.getElementById('btn-reset-filters');
    const downloadImgBtn = document.getElementById('btn-download-edited-img');

    if (rotateLeft) rotateLeft.addEventListener('click', () => { transform.rotation = (transform.rotation - 90) % 360; renderActiveImage(); });
    if (rotateRight) rotateRight.addEventListener('click', () => { transform.rotation = (transform.rotation + 90) % 360; renderActiveImage(); });
    if (flipH) flipH.addEventListener('click', () => { transform.flipH *= -1; renderActiveImage(); });
    if (flipV) flipV.addEventListener('click', () => { transform.flipV *= -1; renderActiveImage(); });
    if (resetBtn) resetBtn.addEventListener('click', () => { resetFilters(); renderActiveImage(); });

    if (downloadImgBtn) {
      downloadImgBtn.addEventListener('click', () => {
        const previewCanvas = document.getElementById('image-editor-canvas');
        if (!previewCanvas) return;
        const link = document.createElement('a');
        link.download = `edited-${images[activeImageIndex]?.name || 'image.png'}`;
        link.href = previewCanvas.toDataURL('image/png');
        link.click();
        window.App.notify('success', 'Đã tải ảnh đã chỉnh sửa về máy!');
      });
    }

    // Convert Images to PDF button
    const btnImagesToPdf = document.getElementById('btn-images-to-pdf');
    if (btnImagesToPdf) {
      btnImagesToPdf.addEventListener('click', convertImagesToPdf);
    }

    // Stamp Image onto PDF button
    const btnStampToPdf = document.getElementById('btn-stamp-to-pdf');
    if (btnStampToPdf) {
      btnStampToPdf.addEventListener('click', stampActiveImageToPdf);
    }
  }

  function resetFilters() {
    transform = {
      rotation: 0,
      flipH: 1,
      flipV: 1,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      blur: 0
    };

    const filters = ['brightness', 'contrast', 'saturation', 'grayscale', 'sepia', 'invert', 'blur'];
    filters.forEach((f) => {
      const slider = document.getElementById(`filter-${f}`);
      const valLabel = document.getElementById(`filter-${f}-val`);
      const defaultVal = f === 'brightness' || f === 'contrast' || f === 'saturation' ? 100 : 0;
      if (slider) slider.value = defaultVal;
      if (valLabel) valLabel.textContent = defaultVal + (f === 'blur' ? 'px' : '%');
    });
  }

  /**
   * Stamp Interactive Placer
   */
  function setupStampPlacer() {
    const box = document.getElementById('stamp-box-handle');
    const container = document.getElementById('stamp-placer-stage');
    const resizeHandle = document.getElementById('stamp-resize-handle');
    const opacitySlider = document.getElementById('stamp-opacity-slider');
    const opacityVal = document.getElementById('stamp-opacity-val');

    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        stampState.opacity = parseFloat(e.target.value) / 100;
        if (opacityVal) opacityVal.textContent = e.target.value + '%';
        if (box) box.style.opacity = stampState.opacity;
      });
    }

    if (!box || !container) return;

    box.addEventListener('mousedown', (e) => {
      if (e.target === resizeHandle) return;
      stampState.isDragging = true;
      stampState.dragStartX = e.clientX - box.offsetLeft;
      stampState.dragStartY = e.clientY - box.offsetTop;
    });

    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        stampState.isResizing = true;
        stampState.dragStartX = e.clientX;
        stampState.dragStartY = e.clientY;
      });
    }

    window.addEventListener('mousemove', (e) => {
      if (stampState.isDragging) {
        const stageRect = container.getBoundingClientRect();
        let newX = e.clientX - stageRect.left - (stampState.dragStartX - box.offsetLeft);
        let newY = e.clientY - stageRect.top - (stampState.dragStartY - box.offsetTop);

        newX = Math.max(0, Math.min(newX, stageRect.width - box.offsetWidth));
        newY = Math.max(0, Math.min(newY, stageRect.height - box.offsetHeight));

        box.style.left = `${newX}px`;
        box.style.top = `${newY}px`;
        stampState.xPct = newX / stageRect.width;
        stampState.yPct = newY / stageRect.height;
      } else if (stampState.isResizing) {
        const stageRect = container.getBoundingClientRect();
        const deltaX = e.clientX - stampState.dragStartX;
        const deltaY = e.clientY - stampState.dragStartY;

        stampState.widthPx = Math.max(50, Math.min(box.offsetWidth + deltaX, stageRect.width - box.offsetLeft));
        stampState.heightPx = Math.max(40, Math.min(box.offsetHeight + deltaY, stageRect.height - box.offsetTop));

        box.style.width = `${stampState.widthPx}px`;
        box.style.height = `${stampState.heightPx}px`;

        stampState.dragStartX = e.clientX;
        stampState.dragStartY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      stampState.isDragging = false;
      stampState.isResizing = false;
    });
  }

  function updateStampBox() {
    const box = document.getElementById('stamp-box-handle');
    if (!box) return;
    box.style.width = `${stampState.widthPx}px`;
    box.style.height = `${stampState.heightPx}px`;
    box.style.opacity = stampState.opacity;
  }

  /**
   * Stamp the currently edited image onto the active PDF page
   */
  async function stampActiveImageToPdf() {
    const previewCanvas = document.getElementById('image-editor-canvas');
    if (!previewCanvas || images.length === 0) {
      window.App.notify('warning', 'Chưa có ảnh nào được chọn để dán!');
      return;
    }

    const dataUrl = previewCanvas.toDataURL('image/png');
    const success = await window.PDFManager.stampImageOntoPage(
      dataUrl,
      stampState.xPct,
      stampState.yPct,
      stampState.widthPx,
      stampState.heightPx,
      stampState.opacity
    );

    if (success) {
      window.App.switchTab('editor');
    }
  }

  /**
   * Convert multiple images into a clean multi-page PDF
   */
  async function convertImagesToPdf() {
    if (images.length === 0) {
      window.App.notify('warning', 'Vui lòng tải lên ít nhất 1 hình ảnh!');
      return;
    }

    try {
      window.App.showGlobalLoading(true, `Đang chuyển đổi ${images.length} ảnh sang PDF...`);
      const pdfDoc = await PDFLib.PDFDocument.create();

      for (let i = 0; i < images.length; i++) {
        const imgItem = images[i];
        let embeddedImage;

        if (imgItem.file.type.includes('png')) {
          const bytes = await imgItem.file.arrayBuffer();
          embeddedImage = await pdfDoc.embedPng(bytes);
        } else {
          const bytes = await imgItem.file.arrayBuffer();
          try {
            embeddedImage = await pdfDoc.embedJpg(bytes);
          } catch (e) {
            embeddedImage = await pdfDoc.embedPng(bytes);
          }
        }

        // Standard A4: 595.28 x 841.89 points
        const a4Width = 595.28;
        const a4Height = 841.89;
        const page = pdfDoc.addPage([a4Width, a4Height]);

        // Fit image keeping aspect ratio with 20pt padding
        const margin = 20;
        const maxW = a4Width - margin * 2;
        const maxH = a4Height - margin * 2;
        const scale = Math.min(maxW / embeddedImage.width, maxH / embeddedImage.height);
        const finalW = embeddedImage.width * scale;
        const finalH = embeddedImage.height * scale;
        const posX = (a4Width - finalW) / 2;
        const posY = (a4Height - finalH) / 2;

        page.drawImage(embeddedImage, {
          x: posX,
          y: posY,
          width: finalW,
          height: finalH
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `images-collection-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 150);

      window.App.notify('success', `Đã ghép thành công ${images.length} ảnh thành file PDF!`);
    } catch (e) {
      console.error(e);
      window.App.notify('error', 'Lỗi chuyển đổi ảnh sang PDF: ' + e.message);
    } finally {
      window.App.showGlobalLoading(false);
    }
  }

  // Helpers
  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  function getImageDimensions(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = dataUrl;
    });
  }

  return {
    init,
    getActiveImage: () => images[activeImageIndex],
    getAllImages: () => [...images]
  };
})();
