/* html-convert Web UI — Frontend JS */
(() => {
  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    files: [],         // Array of File objects with .relativePath
    format: 'pdf',
    jobId: null,
    socket: null,
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dropZone     = $('dropZone');
  const fileInput    = $('fileInput');
  const folderInput  = $('folderInput');
  const fileList     = $('fileList');
  const fileListItems= $('fileListItems');
  const fileListTitle= $('fileListTitle');
  const clearBtn     = $('clearFiles');
  const convertBtn   = $('convertBtn');
  const formatBtns   = document.querySelectorAll('.format-btn');
  const pageSizeGroup= $('pageSizeGroup');
  const pageFormat   = $('pageFormat');
  const docTitle     = $('docTitle');
  const docAuthor    = $('docAuthor');
  const progressSection = $('progressSection');
  const progressLabel   = $('progressLabel');
  const progressPct     = $('progressPct');
  const progressBar     = $('progressBarFill');
  const progressFormat  = $('progressFormat');
  const resultsSection  = $('resultsSection');
  const resultsFiles    = $('resultsFiles');
  const errorSection    = $('errorSection');
  const errorMessage    = $('errorMessage');
  const retryBtn        = $('retryBtn');
  const convertAnother  = $('convertAnother');

  // ── Format selection ──────────────────────────────────────────────────────
  formatBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      formatBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.format = btn.dataset.format;
      // Show page size only for PDF/both
      pageSizeGroup.hidden = state.format === 'epub';
    });
  });

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const items = Array.from(e.dataTransfer.items || []);
    const collected = [];

    for (const item of items) {
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) await processEntry(entry, '', collected);
      } else {
        const file = item.getAsFile();
        if (file) {
          Object.defineProperty(file, 'relativePath', { value: file.name, configurable: true });
          collected.push(file);
        }
      }
    }

    if (collected.length > 0) setFiles(collected);
  });

  /**
   * Recursively process a FileSystemEntry and collect File objects with relativePath.
   */
  async function processEntry(entry, parentPath, results) {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      const relPath = parentPath ? `${parentPath}/${file.name}` : file.name;
      // Only include HTML/assets — not hidden files
      if (!file.name.startsWith('.')) {
        Object.defineProperty(file, 'relativePath', { value: relPath, configurable: true });
        results.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries may need multiple calls for > 100 entries
      let allEntries = [];
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        allEntries = allEntries.concat(batch);
      } while (batch.length > 0);

      for (const child of allEntries) {
        await processEntry(child, parentPath ? `${parentPath}/${entry.name}` : entry.name, results);
      }
    }
  }

  // ── File input (button click) ─────────────────────────────────────────────
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files).map((f) => {
      Object.defineProperty(f, 'relativePath', { value: f.name, configurable: true });
      return f;
    });
    if (files.length > 0) setFiles(files);
    fileInput.value = '';
  });

  folderInput.addEventListener('change', () => {
    const files = Array.from(folderInput.files).map((f) => {
      // webkitRelativePath gives "folderName/sub/file.ext"
      const relPath = f.webkitRelativePath || f.name;
      Object.defineProperty(f, 'relativePath', { value: relPath, configurable: true });
      return f;
    });
    if (files.length > 0) setFiles(files);
    folderInput.value = '';
  });

  // ── File management ───────────────────────────────────────────────────────
  function setFiles(files) {
    state.files = files;
    renderFileList();
    updateConvertBtn();
  }

  function renderFileList() {
    const { files } = state;
    if (files.length === 0) {
      fileList.hidden = true;
      return;
    }

    const htmlFiles = files.filter((f) => /\.(html?)/i.test(f.name));
    fileListTitle.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} selected (${htmlFiles.length} HTML)`;

    fileListItems.innerHTML = '';
    for (const f of files) {
      const li = document.createElement('li');
      const ext = f.name.split('.').pop().toLowerCase();
      const icon = ext === 'html' || ext === 'htm' ? '📄' : ext === 'css' ? '🎨' : ext === 'js' ? '⚡' : '📎';
      li.innerHTML = `
        <span class="file-icon">${icon}</span>
        <span class="file-path" title="${f.relativePath}">${f.relativePath}</span>
        <span class="file-size">${formatBytes(f.size)}</span>
      `;
      fileListItems.appendChild(li);
    }

    fileList.hidden = false;
  }

  clearBtn.addEventListener('click', () => {
    state.files = [];
    fileList.hidden = true;
    updateConvertBtn();
  });

  function updateConvertBtn() {
    const hasHtml = state.files.some((f) => /\.(html?)$/i.test(f.name));
    convertBtn.disabled = !hasHtml;
  }

  // ── Conversion ────────────────────────────────────────────────────────────
  convertBtn.addEventListener('click', startConversion);

  async function startConversion() {
    showSection('progress');
    updateProgress(0, 'Uploading files...');

    const formData = new FormData();
    formData.append('format', state.format === 'both' ? 'pdf,epub' : state.format);
    formData.append('title', docTitle.value.trim());
    formData.append('author', docAuthor.value.trim() || 'html-convert');
    formData.append('pageFormat', pageFormat.value);

    for (const file of state.files) {
      // Use relativePath as the filename so multer can reconstruct folder structure
      formData.append('files', file, file.relativePath);
    }

    let jobId;
    try {
      const res = await fetch('/api/convert', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      jobId = data.jobId;
    } catch (err) {
      showError(err.message);
      return;
    }

    state.jobId = jobId;
    connectSocket(jobId);
  }

  // ── Socket.io ─────────────────────────────────────────────────────────────
  function connectSocket(jobId) {
    if (state.socket) {
      state.socket.disconnect();
    }

    const socket = io();
    state.socket = socket;

    socket.on('connect', () => {
      socket.emit('join', jobId);
    });

    socket.on('job:progress', ({ pct, label, format: fmt }) => {
      updateProgress(pct, label, fmt);
    });

    socket.on('job:done', ({ outputFiles }) => {
      socket.disconnect();
      showResults(outputFiles);
    });

    socket.on('job:error', ({ error }) => {
      socket.disconnect();
      showError(error);
    });

    socket.on('job:update', (job) => {
      if (job.status === 'done') showResults(job.outputFiles);
      else if (job.status === 'error') showError(job.error);
    });
  }

  // ── UI state helpers ──────────────────────────────────────────────────────
  function showSection(name) {
    progressSection.hidden = name !== 'progress';
    resultsSection.hidden  = name !== 'results';
    errorSection.hidden    = name !== 'error';
  }

  function updateProgress(pct, label, fmt) {
    progressLabel.textContent = label || '';
    progressPct.textContent   = `${pct}%`;
    progressBar.style.width   = `${pct}%`;
    if (fmt) progressFormat.textContent = `Converting: ${fmt.toUpperCase()}`;
  }

  function showResults(outputFiles) {
    resultsFiles.innerHTML = '';
    for (const f of outputFiles) {
      const badge = f.format === 'pdf' ? 'pdf' : 'epub';
      const div = document.createElement('div');
      div.className = 'result-file';
      div.innerHTML = `
        <div class="result-file-info">
          <span class="format-badge ${badge}">${f.format.toUpperCase()}</span>
          <span class="result-file-name">${f.filename}</span>
          <span class="result-file-size">${formatBytes(f.size)}</span>
        </div>
        <a class="btn-download" href="${f.downloadUrl}" download="${f.filename}">
          ↓ Download
        </a>
      `;
      resultsFiles.appendChild(div);
    }
    showSection('results');
  }

  function showError(msg) {
    errorMessage.textContent = msg || 'An unknown error occurred.';
    showSection('error');
  }

  retryBtn.addEventListener('click', () => showSection(null));
  convertAnother.addEventListener('click', () => {
    state.files = [];
    state.jobId = null;
    fileList.hidden = true;
    updateConvertBtn();
    showSection(null);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
})();
