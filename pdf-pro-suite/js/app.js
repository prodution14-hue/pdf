/**
 * PDF Studio Pro - Main Application Controller
 * Handles Themes, Routing, Modals, Toasts, and Event Binding
 */

window.App = (function () {
  let activeTab = 'editor';

  function init() {
    initTheme();
    initTabs();
    initDropzones();
    initToolbar();
    initModals();

    // Init Sub-modules
    if (window.PDFManager) PDFManager.init();
    if (window.ImageStudio) ImageStudio.init();

    // Render Lucide icons
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Theme Management (Light / Dark Mode with localStorage)
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('pdfpro_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    applyTheme(isDark);

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentlyDark = document.documentElement.classList.contains('dark');
        applyTheme(!currentlyDark);
      });
    }
  }

  function applyTheme(isDark) {
    const root = document.documentElement;
    const iconContainer = document.getElementById('theme-toggle-icon');

    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('pdfpro_theme', 'dark');
      if (iconContainer) {
        iconContainer.innerHTML = '<i data-lucide="sun" class="w-4 h-4 text-amber-400"></i>';
      }
    } else {
      root.classList.remove('dark');
      localStorage.setItem('pdfpro_theme', 'light');
      if (iconContainer) {
        iconContainer.innerHTML = '<i data-lucide="moon" class="w-4 h-4 text-slate-600"></i>';
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Tab Navigation System
   */
  function initTabs() {
    const navTabs = document.querySelectorAll('.nav-tab-btn');
    navTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabTarget = tab.dataset.tab;
        switchTab(tabTarget);
      });
    });
  }

  function switchTab(target) {
    activeTab = target;

    // Update Tab Buttons
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      if (btn.dataset.tab === target) {
        btn.classList.add('bg-red-500', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-600', 'dark:text-zinc-400', 'hover:bg-slate-100', 'dark:hover:bg-zinc-800');
      } else {
        btn.classList.remove('bg-red-500', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-600', 'dark:text-zinc-400', 'hover:bg-slate-100', 'dark:hover:bg-zinc-800');
      }
    });

    // Update Tab Views
    const views = ['editor', 'pages', 'converter', 'imagestudio', 'utilities'];
    views.forEach((v) => {
      const panel = document.getElementById(`tab-view-${v}`);
      if (panel) {
        if (v === target || (target === 'image-studio' && v === 'imagestudio')) {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      }
    });

    // When switching to pages tab, refresh thumbnails
    if (target === 'pages' && window.PDFManager) {
      renderPagesGridView();
    }

    // Refresh icons
    if (window.lucide) lucide.createIcons();
  }

  /**
   * PDF Drag & Drop Handlers
   */
  function initDropzones() {
    const landingDropzone = document.getElementById('landing-pdf-dropzone');
    const landingInput = document.getElementById('landing-pdf-input');
    const quickOpenBtn = document.getElementById('btn-quick-open-pdf');

    if (landingInput) {
      landingInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          PDFManager.loadPdf(e.target.files[0]);
        }
      });
    }

    if (quickOpenBtn && landingInput) {
      quickOpenBtn.addEventListener('click', () => landingInput.click());
    }

    if (landingDropzone && landingInput) {
      landingDropzone.addEventListener('click', () => landingInput.click());
      landingDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        landingDropzone.classList.add('border-red-500', 'bg-red-50/20', 'scale-[1.01]');
      });
      landingDropzone.addEventListener('dragleave', () => {
        landingDropzone.classList.remove('border-red-500', 'bg-red-50/20', 'scale-[1.01]');
      });
      landingDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        landingDropzone.classList.remove('border-red-500', 'bg-red-50/20', 'scale-[1.01]');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          PDFManager.loadPdf(e.dataTransfer.files[0]);
        }
      });
    }

    // Global file drag over window
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  /**
   * Workspace Toolbar Listeners
   */
  function initToolbar() {
    // Zoom Controls
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const zoomFitBtn = document.getElementById('btn-zoom-fit');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => PDFManager.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => PDFManager.zoomOut());
    if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => PDFManager.fitWidth());

    // Page Navigation
    const prevBtn = document.getElementById('btn-page-prev');
    const nextBtn = document.getElementById('btn-page-next');
    const pageJumpInput = document.getElementById('page-jump-input');

    if (prevBtn) prevBtn.addEventListener('click', () => PDFManager.prevPage());
    if (nextBtn) nextBtn.addEventListener('click', () => PDFManager.nextPage());
    if (pageJumpInput) {
      pageJumpInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) PDFManager.goToPage(val);
      });
    }

    // Annotation Tools
    const toolBtns = document.querySelectorAll('.annotation-tool-btn');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolBtns.forEach((b) => b.classList.remove('bg-red-500', 'text-white'));
        btn.classList.add('bg-red-500', 'text-white');
        const tool = btn.dataset.tool;
        PDFManager.setActiveTool(tool);
      });
    });

    // Tool Color & Size
    const colorPicker = document.getElementById('annot-color-picker');
    const brushSize = document.getElementById('annot-brush-size');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => PDFManager.setToolColor(e.target.value));
    }
    if (brushSize) {
      brushSize.addEventListener('input', (e) => PDFManager.setBrushSize(parseInt(e.target.value)));
    }

    // Clear Annotations
    const clearAnnotBtn = document.getElementById('btn-clear-annot');
    if (clearAnnotBtn) {
      clearAnnotBtn.addEventListener('click', () => PDFManager.clearPageAnnotations());
    }

    // Export PDF Button
    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => PDFManager.exportPdf());
    }

    // Quick Converter Action: Convert Current PDF to Word
    const btnCurPdfToWord = document.getElementById('btn-convert-current-pdf-to-word');
    if (btnCurPdfToWord) {
      btnCurPdfToWord.addEventListener('click', () => {
        const state = PDFManager.getState();
        if (state.rawBytes) {
          DocConverter.convertPdfToWord(state.rawBytes, state.fileName.replace(/\.pdf$/i, '') + '.docx');
        } else {
          notify('warning', 'Vui lòng mở một tài liệu PDF trước!');
        }
      });
    }

    // Standalone PDF to Word File Input
    const standalonePdfWordInput = document.getElementById('standalone-pdf-to-word-input');
    if (standalonePdfWordInput) {
      standalonePdfWordInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          DocConverter.convertPdfToWord(e.target.files[0]);
        }
      });
    }

    // Word (.docx) to PDF Input
    const wordInput = document.getElementById('word-to-pdf-file-input');
    if (wordInput) {
      wordInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          DocConverter.previewWordDoc(e.target.files[0]);
        }
      });
    }

    const btnWordExport = document.getElementById('btn-export-word-to-pdf');
    if (btnWordExport) {
      btnWordExport.addEventListener('click', () => DocConverter.exportWordToPdf());
    }
  }

  /**
   * Modals & Utilities Handlers
   */
  function initModals() {
    // Split PDF modal
    const openSplitBtn = document.getElementById('btn-open-split-modal');
    const splitModal = document.getElementById('modal-split-pdf');
    const closeSplitBtn = document.getElementById('btn-close-split-modal');
    const confirmSplitBtn = document.getElementById('btn-confirm-split');
    const splitRangeInput = document.getElementById('split-range-input');

    if (openSplitBtn && splitModal) {
      openSplitBtn.addEventListener('click', () => splitModal.classList.remove('hidden'));
    }
    if (closeSplitBtn && splitModal) {
      closeSplitBtn.addEventListener('click', () => splitModal.classList.add('hidden'));
    }
    if (confirmSplitBtn && splitRangeInput) {
      confirmSplitBtn.addEventListener('click', () => {
        const range = splitRangeInput.value.trim();
        PDFManager.splitPdf(range);
        splitModal.classList.add('hidden');
      });
    }

    // Merge PDF file input
    const mergeInput = document.getElementById('merge-pdf-files-input');
    if (mergeInput) {
      mergeInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length >= 2) {
          PDFManager.mergePdfs(Array.from(e.target.files));
        } else {
          notify('warning', 'Vui lòng chọn từ 2 file PDF trở lên!');
        }
      });
    }

    // Compress PDF
    const compressBtn = document.getElementById('btn-quick-compress');
    if (compressBtn) {
      compressBtn.addEventListener('click', () => PDFManager.compressPdf());
    }

    // Rotate all
    const rotateAllBtn = document.getElementById('btn-rotate-all-pages');
    if (rotateAllBtn) {
      rotateAllBtn.addEventListener('click', () => PDFManager.rotateAllPages(90));
    }
  }

  /**
   * Pages Grid View (Quản lý toàn bộ trang trực quan)
   */
  async function renderPagesGridView() {
    const container = document.getElementById('pages-manager-grid');
    const state = PDFManager.getState();
    if (!container || !state.pdfJsDoc) return;

    container.innerHTML = '';

    for (let i = 1; i <= state.numPages; i++) {
      const card = document.createElement('div');
      card.className =
        'p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col items-center gap-2 group hover:border-red-500 transition-all';
      card.innerHTML = `
        <div class="relative w-full aspect-[3/4] bg-slate-100 dark:bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-zinc-800">
          <canvas id="grid-page-thumb-${i}" class="w-full h-full object-contain pointer-events-none"></canvas>
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button class="grid-page-rotate p-2 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 hover:scale-105 shadow-md" data-p="${i}" title="Xoay trang">
              <i data-lucide="rotate-cw" class="w-4 h-4"></i>
            </button>
            <button class="grid-page-del p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 hover:scale-105 shadow-md" data-p="${i}" title="Xóa trang">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <div class="w-full flex items-center justify-between px-1">
          <span class="text-xs font-semibold text-slate-800 dark:text-zinc-200">Trang ${i}</span>
          <button class="grid-view-page-btn text-xs text-red-500 hover:underline font-medium" data-p="${i}">Mở xem</button>
        </div>
      `;

      container.appendChild(card);

      // Render thumbnail
      renderGridMiniThumb(i, `grid-page-thumb-${i}`);
    }

    container.querySelectorAll('.grid-page-rotate').forEach((btn) => {
      btn.addEventListener('click', () => {
        PDFManager.rotatePage(parseInt(btn.dataset.p), 90);
      });
    });

    container.querySelectorAll('.grid-page-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        PDFManager.deletePage(parseInt(btn.dataset.p));
      });
    });

    container.querySelectorAll('.grid-view-page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        PDFManager.goToPage(parseInt(btn.dataset.p));
        switchTab('editor');
      });
    });

    if (window.lucide) lucide.createIcons({ root: container });
  }

  async function renderGridMiniThumb(pageIndex, canvasId) {
    const state = PDFManager.getState();
    if (!state.pdfJsDoc) return;
    try {
      const page = await state.pdfJsDoc.getPage(pageIndex);
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 0.35 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    } catch (e) {
      console.warn('Grid mini thumb err', e);
    }
  }

  /**
   * Toast Notification System
   */
  function notify(type = 'info', message = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-500 text-white border-emerald-600',
      error: 'bg-red-500 text-white border-red-600',
      warning: 'bg-amber-500 text-white border-amber-600',
      info: 'bg-slate-900 dark:bg-zinc-800 text-white border-slate-700'
    };

    const icons = {
      success: 'check-circle-2',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium animate-fade-in ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">${message}</span>
      <button class="toast-close-btn opacity-80 hover:opacity-100 transition-opacity">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;

    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function showGlobalLoading(show, message = 'Đang xử lý...') {
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

  return {
    init,
    switchTab,
    notify,
    showGlobalLoading
  };
})();

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
