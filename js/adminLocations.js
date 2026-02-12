/**
 * Admin Location Management Script
 * Features: Full CRUD, SweetAlert2, 320x240 Image Cropper, Auto-Coordinate Extraction
 */
document.addEventListener('DOMContentLoaded', () => {
const ADMIN_KEY_NAME = 'ADMIN_API_KEY';

async function adminFetch(url, options = {}) {
  const key = localStorage.getItem(ADMIN_KEY_NAME);

  const res = await fetch(url, {
  ...options,
  credentials: 'same-origin',
  headers: {
    ...(options.headers || {}),
    'X-API-Key': key
  }
});


  if (res.status === 401 || res.status === 403) {
    Swal.fire('Unauthorized', 'Admin session expired', 'error')
      .then(() => {
        localStorage.removeItem(ADMIN_KEY_NAME);
        location.reload();
      });
    throw new Error('Unauthorized');
  }

  return res;
}

  const API = 'https://bebeksemangat-production.up.railway.app/locations';
  const UPLOAD_API = 'https://bebeksemangat-production.up.railway.app/locations/upload';

  /* ================= DOM ELEMENTS ================= */
  const locationModal = document.getElementById('locationModal');
  const cropModal = document.getElementById('cropModal');
  const locationForm = document.getElementById('locationForm');
  const storeList = document.getElementById('storeList');

  // Form Inputs
  const inputId = document.getElementById('locationId');
  const inputName = document.getElementById('locationName');
  const inputHours = document.getElementById('locationHours');
  const inputAddress = document.getElementById('locationAddress');
  const inputMapsUrl = document.getElementById('locationMapsUrl');
  const inputLat = document.getElementById('locationLat');
  const inputLng = document.getElementById('locationLng');
  const inputRating = document.getElementById('locationRating');
  const inputReviews = document.getElementById('locationReviews');
  const inputImageUrl = document.getElementById('locationImageUrl');
  const inputImageFile = document.getElementById('locationImageFile');
  const preview = document.getElementById('imagePreview');
  const inputPhone = document.getElementById('PhoneNum');


  // Cropper Elements
  const cropStage = document.getElementById('cropStage');
  const cropFrame = document.querySelector('.crop-frame');
  const cropImg = document.getElementById('cropperImage');
  const zoomInput = document.getElementById('cropZoom');

  /* ================= STATE ================= */
  let scale = 1, pos = { x: 0, y: 0 }, start = { x: 0, y: 0 }, dragging = false;
  let originalImage = new Image();
  document.getElementById('adminLogout')?.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_KEY_NAME);
    location.reload();
  });
  /* ================= HELPERS ================= */
  const closeModals = () => {
    locationModal.classList.remove('is-open');
    cropModal.classList.remove('is-open');
    locationForm.reset();
    inputId.value = '';
    preview.innerHTML = '';
  };

  const loadLocations = async () => {
    try {
      const res = await adminFetch(API);
      const stores = await res.json();
      renderAdminStores(stores);
    } catch (err) {
      console.error("Fetch error:", err);
      Swal.fire('Error', 'Could not load stores from database', 'error');
    }
  };

  /**
   * Automatically extracts coordinates from Google Maps URLs
   * Pattern: @latitude,longitude
   */
  const extractCoordsFromURL = (url) => {
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regex);
    return match ? { lat: match[1], lng: match[2] } : null;
  };

  function renderAdminStores(stores) {
    storeList.innerHTML = '';
    stores.forEach(store => {
      const hours = store.hours || 'Not set';
      const rating = store.rating || '5.0';
      const reviews = store.reviews || '0';

      storeList.insertAdjacentHTML('beforeend', `
        <article class="store-card fade-up" data-id="${store.id}">
          <div class="admin-actions-floating">
            <button type="button" class="btn-icon btn-edit" title="Edit">✎</button>
            <button type="button" class="btn-icon btn-delete" title="Delete">×</button>
          </div>
          <div class="store-image" style="background-image:url('${store.image_url}')"></div>
          <div class="store-content">
            <div class="store-rating">
              <span class="rating-badge">${rating}</span>
              <div class="stars"><span>★</span></div>
              <span class="store-distance">(${reviews} reviews)</span>
            </div>
            <h3 class="store-title">${store.name}</h3>
            <p class="store-hours"><strong>Clock:</strong> ${hours}</p>
            <p class="store-address"><strong>Location:</strong> ${store.address}</p>
          </div>
        </article>
      `);
    });

    // Append Add Card
    storeList.insertAdjacentHTML('beforeend', `
      <div class="add-store-card" id="btnAddStore">
        <span>+</span>
      </div>
    `);
  }

  /* ================= CROPPER LOGIC (320x240) ================= */
  function updateTransform() {
    cropImg.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
  }

  inputImageFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      originalImage.onload = () => {
        cropImg.src = originalImage.src;
        cropModal.classList.add('is-open');
        // Fit for 320x240 frame
        scale = Math.max(320 / originalImage.naturalWidth, 240 / originalImage.naturalHeight);
        pos = { x: 0, y: 0 };
        zoomInput.value = scale;
        updateTransform();
      };
      originalImage.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  cropStage.addEventListener('mousedown', e => { dragging = true; start = { x: e.clientX - pos.x, y: e.clientY - pos.y }; });
  window.addEventListener('mousemove', e => { if (!dragging) return; pos = { x: e.clientX - start.x, y: e.clientY - start.y }; updateTransform(); });
  window.addEventListener('mouseup', () => dragging = false);
  zoomInput.addEventListener('input', () => { scale = zoomInput.value; updateTransform(); });

  document.getElementById('btnCropApply').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480; // Standard 4:3 high res
    const ctx = canvas.getContext('2d');
    const frame = cropFrame.getBoundingClientRect();
    const img = cropImg.getBoundingClientRect();
    const s = originalImage.naturalWidth / img.width;

    ctx.drawImage(originalImage, (frame.left - img.left) * s, (frame.top - img.top) * s, frame.width * s, frame.height * s, 0, 0, 640, 480);

    canvas.toBlob(async blob => {
      const fd = new FormData();
      fd.append('file', blob, 'store.jpg');
      Swal.fire({ title: 'Uploading Image...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      try {
        const res = await adminFetch(UPLOAD_API, { method: 'POST', body: fd });
        const data = await res.json();
        inputImageUrl.value = data.url; // BUKAN ditambah localhost

        preview.innerHTML = `<img src="${inputImageUrl.value}" style="width:100px; border-radius:8px; margin-top:10px;">`;
        cropModal.classList.remove('is-open');
        Swal.fire({ icon: 'success', title: 'Image Uploaded', timer: 1000, showConfirmButton: false });
      } catch (err) {
        Swal.fire('Error', 'Image upload failed', 'error');
      }
    }, 'image/jpeg');
  });

  /* ================= AUTO-COORDINATE LISTENER ================= */
  inputMapsUrl.addEventListener('input', (e) => {
    const coords = extractCoordsFromURL(e.target.value);
    if (coords) {
      inputLat.value = coords.lat;
      inputLng.value = coords.lng;
      // Brief visual indicator
      inputLat.style.backgroundColor = '#f0fff0';
      inputLng.style.backgroundColor = '#f0fff0';
      setTimeout(() => {
        inputLat.style.backgroundColor = 'white';
        inputLng.style.backgroundColor = 'white';
      }, 1000);
    }
  });

  /* ================= EVENT DELEGATION ================= */
  document.body.addEventListener('click', async e => {

    // 1. ADD NEW
    if (e.target.closest('#btnAddStore')) {
      locationForm.reset();
      inputId.value = '';
      preview.innerHTML = '';
      document.getElementById('modalTitle').textContent = "Add New Location";
      locationModal.classList.add('is-open');
    }

    // 2. EDIT
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      const id = editBtn.closest('.store-card').dataset.id;
      Swal.fire({ title: 'Loading...', didOpen: () => Swal.showLoading() });

      try {
        const res = await adminFetch(API);
        const stores = await res.json();

// 🔥 SORT BY ID (DESC)
stores.sort((a, b) => b.id - a.id);

renderAdminStores(stores);

        const s = stores.find(item => item.id == id);

        if (s) {
          inputId.value = s.id;
          inputName.value = s.name;
          inputHours.value = s.hours || '';
          inputPhone.value = s.phone_number;

          inputAddress.value = s.address;
          inputMapsUrl.value = s.maps_url;
          inputLat.value = s.lat;
          inputLng.value = s.lng;
          inputRating.value = s.rating;
          inputReviews.value = s.reviews;
          inputImageUrl.value = s.image_url;
          preview.innerHTML = `<img src="${s.image_url}" style="width:100px; border-radius:8px; margin-top:10px;">`;

          document.getElementById('modalTitle').textContent = "Edit Location";
          locationModal.classList.add('is-open');
          Swal.close();
        }
      } catch (err) {
        Swal.fire('Error', 'Could not load store data', 'error');
      }
    }

    // 3. DELETE
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      const id = delBtn.closest('.store-card').dataset.id;
      const result = await Swal.fire({
        title: 'Delete Store?',
        text: "You will not be able to recover this location.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#582C49',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it'
      });

      if (result.isConfirmed) {
        try {
          await adminFetch(`${API}/${id}`, { method: 'DELETE' });
          loadLocations();
          Swal.fire('Deleted', 'Store removed successfully', 'success');
        } catch (err) {
          Swal.fire('Error', 'Deletion failed', 'error');
        }
      }
    }

    // 4. CANCEL
    if (e.target.id === 'btnLocationCancel' || e.target.id === 'btnCropCancel' || e.target.classList.contains('modal-backdrop')) {
      closeModals();
    }
  });

  /* ================= SUBMIT FORM ================= */
  locationForm.addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      name: inputName.value,
      phone_number: inputPhone.value || null,
      address: inputAddress.value,
      maps_url: inputMapsUrl.value,
      hours: inputHours.value,
      lat: parseFloat(inputLat.value),
      lng: parseFloat(inputLng.value),
      rating: parseFloat(inputRating.value),
      reviews: parseInt(inputReviews.value),
      image_url: inputImageUrl.value
    };

if (!isNaN(inputRating.value)) {
  payload.rating = Number(inputRating.value);
}
if (!isNaN(inputReviews.value)) {
  payload.reviews = Number(inputReviews.value);
}
    const isUpdate = inputId.value !== '';
    const url = isUpdate ? `${API}/${inputId.value}` : API;
    const method = isUpdate ? 'PUT' : 'POST';

    Swal.fire({ title: 'Saving...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeModals();
        loadLocations();
        Swal.fire('Success', 'Store details saved', 'success');
      } else {
        throw new Error();
      }
    } catch (err) {
      Swal.fire('Error', 'Could not save location. Please check all fields.', 'error');
    }
  });

  loadLocations();
});