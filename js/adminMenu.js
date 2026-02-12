/**
 * Admin Menu Management Script - Final Optimized Version
 */
document.addEventListener('DOMContentLoaded', async () => {

  const API = 'https://bebeksemangat-production.up.railway.app/menu/';
  const UPLOAD_API = 'https://bebeksemangat-production.up.railway.app/menu/upload';
  const ADMIN_KEY_NAME = 'ADMIN_API_KEY';

  // State untuk mencegah proses double
  let isSubmitting = false;

  /* ================= GET AUTH KEY ================= */
  // Mengambil key yang sudah disimpan oleh script HTML
  const getAdminKey = () => localStorage.getItem(ADMIN_KEY_NAME);

  // Helper fetch yang menyisipkan Key secara otomatis
  async function adminFetch(url, options = {}) {
    const key = getAdminKey();

    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-API-Key': key
      }
    });

    if (res.status === 401) {
      Swal.fire({
        icon: 'error',
        title: 'Unauthorized',
        text: 'Admin key tidak valid atau sesi berakhir.'
      }).then(() => {
        localStorage.removeItem(ADMIN_KEY_NAME);
        location.reload();
      });
      throw new Error('Unauthorized');
    }

    return res;
  }

  /* ================= DOM ELEMENTS ================= */
  const menuModal = document.getElementById('menuModal');
  const cropModal = document.getElementById('cropModal');
  const menuForm = document.getElementById('menuForm');

  const inputId = document.getElementById('menuId');
  const inputName = document.getElementById('menuName');
  const inputDesc = document.getElementById('menuDesc');
  const inputPrice = document.getElementById('menuPrice');
  const inputImageUrl = document.getElementById('menuImageUrl');
  const inputImageFile = document.getElementById('menuImageFile');
  const preview = document.getElementById('imagePreview');

  const cropStage = cropModal.querySelector('.cropper-stage');
  const cropFrame = cropModal.querySelector('.crop-frame');
  const cropImg = document.getElementById('cropperImage');
  const zoomInput = document.getElementById('cropZoom');

  const btnCropApply = document.getElementById('btnCropApply');
  const btnCropCancel = document.getElementById('btnCropCancel');
  const btnMenuCancel = document.getElementById('btnMenuCancel');

  /* ================= STATE & HELPERS ================= */
  let scale = 1, pos = { x: 0, y: 0 }, start = { x: 0, y: 0 }, dragging = false;
  let originalImage = new Image(), currentCategory = null;

  document.getElementById('adminLogout')?.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_KEY_NAME);
    location.reload();
  });

  function updateTransform() {
    cropImg.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
  }

  function resetCrop() {
    scale = 1; pos = { x: 0, y: 0 };
    zoomInput.value = 1;
    updateTransform();
  }

  function fitImageToFrame() {
    if (!cropFrame || !originalImage.naturalWidth) return;
    const fw = cropFrame.clientWidth, fh = cropFrame.clientHeight;
    const iw = originalImage.naturalWidth, ih = originalImage.naturalHeight;
    const fitScale = Math.max(fw / iw, fh / ih) * 0.6;
    scale = fitScale; pos = { x: 0, y: 0 };
    zoomInput.min = fitScale.toFixed(2);
    zoomInput.max = (fitScale * 3).toFixed(2);
    zoomInput.value = fitScale.toFixed(2);
    updateTransform();
  }

  const closeAllModals = () => {
    menuModal.classList.remove('is-open');
    cropModal.classList.remove('is-open');
    if (inputImageFile) inputImageFile.value = '';
    resetCrop();
  };

  /* ================= CROPPER EVENTS ================= */
  inputImageFile?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      originalImage.onload = () => {
        cropImg.src = originalImage.src;
        cropModal.classList.add('is-open');
        requestAnimationFrame(() => fitImageToFrame());
      };
      originalImage.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  zoomInput?.addEventListener('input', () => {
    scale = parseFloat(zoomInput.value);
    updateTransform();
  });

  const getPoint = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  const dragStart = (e) => { dragging = true; const p = getPoint(e); start.x = p.x - pos.x; start.y = p.y - pos.y; if (e.type === 'mousedown') e.preventDefault(); };
  const dragMove = (e) => { if (!dragging) return; const p = getPoint(e); pos.x = p.x - start.x; pos.y = p.y - start.y; updateTransform(); };
  const dragEnd = () => dragging = false;

  cropStage?.addEventListener('mousedown', dragStart);
  cropStage?.addEventListener('touchstart', dragStart, { passive: false });
  window.addEventListener('mousemove', dragMove);
  window.addEventListener('touchmove', dragMove, { passive: false });
  window.addEventListener('mouseup', dragEnd);
  window.addEventListener('touchend', dragEnd);

  btnMenuCancel?.addEventListener('click', () => {
  inputImageUrl.value = '';
  closeAllModals();
});

  btnCropCancel?.addEventListener('click', closeAllModals);

  /* ================= ACTION HANDLERS ================= */

  // Upload Image ke Supabase via Backend
  btnCropApply?.addEventListener('click', () => {
    const frameRect = cropFrame.getBoundingClientRect();
    const imgRect = cropImg.getBoundingClientRect();
    const scaleX = originalImage.naturalWidth / imgRect.width;
    const scaleY = originalImage.naturalHeight / imgRect.height;
    const sx = (frameRect.left - imgRect.left) * scaleX;
    const sy = (frameRect.top - imgRect.top) * scaleY;
    const sw = frameRect.width * scaleX;
    const sh = frameRect.height * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = 360; canvas.height = 365;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, sx, sy, sw, sh, 0, 0, 360, 365);

    canvas.toBlob(async blob => {
  const file = new File([blob], 'menu_item.jpg', { type: 'image/jpeg' });

  const fd = new FormData();
  fd.append('file', file);


      Swal.fire({ title: 'Uploading to Supabase...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      try {
        const res = await adminFetch(UPLOAD_API, { method: 'POST', body: fd });
        const data = await res.json();

        inputImageUrl.value = data.url; // URL dari Supabase
        preview.innerHTML = `<img src="${data.url}" style="width:100px;border-radius:6px;">`;

        cropModal.classList.remove('is-open');
        Swal.fire({ icon: 'success', title: 'Image Uploaded', timer: 1000, showConfirmButton: false });
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Upload failed: ' + err.message, 'error');
      }
    }, 'image/jpeg');
  });

  // Load Menu
  const loadMenu = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      document.querySelectorAll('.menu-grid').forEach(grid => {
        const cat = grid.dataset.category;
        const items = data[cat] || [];
        grid.innerHTML = '';
        items.forEach(item => {
          grid.insertAdjacentHTML('beforeend', `
            <article class="menu-card" data-id="${item.id}">
              <div class="menu-image" style="background-image:url('${item.image || ''}')"></div>
              <div class="menu-info">
                <h3 class="menu-title">${item.title}</h3>
                <p class="menu-desc">${item.desc || ''}</p>
                <div class="menu-price">Rp ${item.price.toLocaleString('id-ID')}</div>
                <div class="admin-actions">
                  <button class="btn btn-edit">Edit</button>
                  <button class="btn btn-delete">Delete</button>
                </div>
              </div>
            </article>
          `);
        });
        grid.insertAdjacentHTML('beforeend', `
          <article class="menu-card add-card">
            <div class="menu-image" data-category="${cat}" style="cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:40px; color:#999; border: 2px dashed #ccc;">
              <span>+</span>
            </div>
          </article>`);
      });
    } catch (err) { console.error("Failed to load menu:", err); }
  };

  // Delegated Clicks
  document.body.addEventListener('click', async (e) => {
    if (e.target.classList.contains('modal-backdrop')) closeAllModals();

    const addCard = e.target.closest('.add-card');
    if (addCard) {
      menuForm.reset();
      inputId.value = '';
      inputImageUrl.value = '';
      preview.innerHTML = '';
      currentCategory = addCard.querySelector('.menu-image').dataset.category;
      document.getElementById('modalTitle').textContent = `Add to ${currentCategory}`;
      menuModal.classList.add('is-open');
    }

    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      const card = editBtn.closest('.menu-card');
      const id = card.dataset.id;
      currentCategory = card.closest('.menu-grid').dataset.category;
      const res = await fetch(API);
      const data = await res.json();
      const item = data[currentCategory].find(i => i.id == id);
      if (item) {
        inputId.value = item.id;
        inputName.value = item.title;
        inputDesc.value = item.desc || '';
        inputPrice.value = item.price;
        inputImageUrl.value = item.image || '';
        preview.innerHTML = item.image ? `<img src="${item.image}" style="width:100px; border-radius:4px;">` : '';
        document.getElementById('modalTitle').textContent = 'Edit Menu Item';
        menuModal.classList.add('is-open');
      }
    }

    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      const id = delBtn.closest('.menu-card').dataset.id;
      const result = await Swal.fire({
        title: 'Hapus Item?',
        text: "Item akan dinonaktifkan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
      });
      if (result.isConfirmed) {
        try {
          await adminFetch(`${API}${id}`, { method: 'DELETE' });
          loadMenu();
          Swal.fire('Deleted!', 'Item berhasil dihapus.', 'success');
        } catch (err) {
          Swal.fire('Error', 'Gagal menghapus item', 'error');
        }
      }
    }
  });

  // Submit Form (Mencegah Double Submit)
  menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isSubmitting) return; // Kunci jika sedang proses

    const payload = {
      title: inputName.value,
      desc: inputDesc.value,
      price: parseInt(inputPrice.value) || 0,
      image_url: inputImageUrl.value,
      category: currentCategory
    };

    const isUpdate = inputId.value !== '';
    const url = isUpdate ? `${API}${inputId.value}` : API;
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      isSubmitting = true;
      Swal.fire({ title: 'Saving menu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeAllModals();
        await loadMenu();
        Swal.fire('Success', 'Menu saved!', 'success');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menyimpan menu', 'error');
    } finally {
      isSubmitting = false; // Buka kunci proses
    }
  });

  loadMenu();
});