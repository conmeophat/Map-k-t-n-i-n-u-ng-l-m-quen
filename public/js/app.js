// ============ Foodie Map Vietnam - Frontend ============
const API = '/api';

let map;
let markers = [];
let allPlaces = [];
let activeCategory = 'all';
let activeCity = 'all';
let activePriceMin = 'all';
let activePriceMax = 'all';
let selectedPlaceId = null;

// Category icons
const CAT_ICONS = { food: '🍲', shopping: '🛍️', cafe: '☕', nightlife: '🌃' };
const CAT_CLASS = { food: 'cat-food', shopping: 'cat-shopping', cafe: 'cat-cafe', nightlife: 'cat-nightlife' };
const CAT_LABEL = { food: 'Ẩm thực', shopping: 'Shopping', cafe: 'Café', nightlife: 'Giải trí' };

// ============ Init Map ============
function initMap() {
  map = L.map('map').setView([16.05, 106.7], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Click to pick coordinates for add-place form
  map.on('click', (e) => {
    const modal = document.getElementById('addPlaceModal');
    if (!modal.classList.contains('hidden')) {
      const latInput = document.querySelector('input[name="lat"]');
      const lngInput = document.querySelector('input[name="lng"]');
      latInput.value = e.latlng.lat.toFixed(6);
      lngInput.value = e.latlng.lng.toFixed(6);
      showToast('📍 Đã lấy tọa độ: ' + e.latlng.lat.toFixed(4) + ', ' + e.latlng.lng.toFixed(4));
    }
  });
}

// ============ Load & Render ============
async function loadPlaces() {
  const params = new URLSearchParams();
  if (activeCategory !== 'all') params.set('category', activeCategory);
  if (activeCity !== 'all') params.set('city', activeCity);
  if (activePriceMin !== 'all') params.set('price_min', activePriceMin);
  if (activePriceMax !== 'all') params.set('price_max', activePriceMax);
  const q = document.getElementById('searchInput').value.trim();
  if (q) params.set('q', q);

  try {
    const res = await fetch(API + '/places?' + params.toString());
    allPlaces = await res.json();
    renderList();
    renderMap();
    updateStats();
  } catch (err) {
    showToast('⚠️ Lỗi tải dữ liệu: ' + err.message);
  }
}

function renderList() {
  const list = document.getElementById('placeList');
  if (!allPlaces.length) {
    list.innerHTML = '<p class="list-hint">Không tìm thấy địa điểm phù hợp 😕</p>';
    return;
  }
  list.innerHTML = allPlaces.map(p => {
    const stars = '★'.repeat(Math.round(p.avg_rating)) + '☆'.repeat(5 - Math.round(p.avg_rating));
    const price = p.price_min != null
      ? formatMoney(p.price_min) + (p.price_max ? ' - ' + formatMoney(p.price_max) : '')
      : 'Chưa cập nhật giá';
    return `
      <div class="place-card" data-id="${p.id}" onclick="openPlace(${p.id})">
        <div class="place-card-header">
          <div>
            <span class="place-cat ${CAT_CLASS[p.category] || 'cat-food'}">${CAT_ICONS[p.category] || '📍'} ${CAT_LABEL[p.category] || p.category}</span>
            <h3>${escapeHtml(p.name)}</h3>
          </div>
        </div>
        <div class="place-meta">
          <span>📍 ${escapeHtml(p.city)}</span>
          <span class="rating">${p.avg_rating ? '★ ' + p.avg_rating.toFixed(1) : '☆ Chưa có đánh giá'}</span>
          <span>(${p.review_count} review)</span>
        </div>
        <div class="place-price">💰 ${escapeHtml(price)}</div>
      </div>`;
  }).join('');
}

function renderMap() {
  // Clear old markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  allPlaces.forEach(p => {
    const icon = L.divIcon({
      className: 'custom-marker',
      html: '<span class="pin">' + (CAT_ICONS[p.category] || '📍') + '</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 30],
      popupAnchor: [0, -30]
    });
    const marker = L.marker([p.lat, p.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="min-width:180px">
          <strong>${escapeHtml(p.name)}</strong><br/>
          <small>${escapeHtml(p.city)} · ${CAT_LABEL[p.category] || p.category}</small><br/>
          <span style="color:#f59e0b">${p.avg_rating ? '★ ' + p.avg_rating.toFixed(1) : 'Chưa đánh giá'}</span>
          <br/><button onclick="openPlace(${p.id})" style="margin-top:6px;padding:4px 10px;background:#e63946;color:#fff;border:none;border-radius:5px;cursor:pointer">Xem chi tiết</button>
        </div>`);
    marker.on('click', () => openPlace(p.id));
    markers.push(marker);
  });

  if (allPlaces.length) {
    const bounds = L.latLngBounds(allPlaces.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

function updateStats() {
  document.getElementById('mapStats').textContent =
    '📍 ' + allPlaces.length + ' địa điểm · ' + CAT_LABEL[activeCategory] ? '' : '';
  document.getElementById('mapStats').textContent = '📍 ' + allPlaces.length + ' địa điểm đang hiển thị';
}

// ============ Detail & Review ============
async function openPlace(id) {
  selectedPlaceId = id;
  const panel = document.getElementById('detailPanel');
  panel.classList.remove('hidden');
  document.getElementById('detailContent').innerHTML = '<p style="padding:20px">Đang tải...</p>';

  try {
    const res = await fetch(API + '/places/' + id);
    const { place, reviews } = await res.json();
    renderDetail(place, reviews);
  } catch (err) {
    document.getElementById('detailContent').innerHTML = '<p>Lỗi tải chi tiết</p>';
  }
}

function renderDetail(place, reviews) {
  const heroClass = 'hero-' + (place.category || 'food');
  const stars = '★'.repeat(Math.round(place.avg_rating)) + '☆'.repeat(5 - Math.round(place.avg_rating));
  const price = place.price_min != null
    ? formatMoney(place.price_min) + (place.price_max ? ' - ' + formatMoney(place.price_max) : '')
    : 'Chưa cập nhật giá';

  const reviewsHtml = reviews.length
    ? reviews.map(r => `
        <div class="review-item">
          <div class="review-head">
            <span class="review-author">👤 ${escapeHtml(r.author)}</span>
            <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          <div class="review-date">${formatDate(r.created_at)}</div>
          ${r.comment ? '<div class="review-comment">' + escapeHtml(r.comment) + '</div>' : ''}
          <div class="review-tags">
            ${r.food_quality ? '<span class="tag">🍽️ Món ăn: ' + r.food_quality + '/5</span>' : ''}
            ${r.price_value ? '<span class="tag">💰 Giá: ' + r.price_value + '/5</span>' : ''}
          </div>
        </div>`).join('')
    : '<p style="color:#7a7a7a;font-size:13px">Chưa có review nào. Hãy là người đầu tiên! 🎉</p>';

  document.getElementById('detailContent').innerHTML = `
    <div class="detail-hero ${heroClass}">
      <span style="font-size:40px">${CAT_ICONS[place.category] || '📍'}</span>
    </div>
    <div class="detail-body">
      <h2>${escapeHtml(place.name)}</h2>
      <div class="detail-city">📍 ${escapeHtml(place.city)}${place.address ? ' · ' + escapeHtml(place.address) : ''}</div>
      <div class="detail-rating-row">
        <span class="big-rating">${place.avg_rating ? place.avg_rating.toFixed(1) : '—'}</span>
        <div>
          <div class="stars">${stars}</div>
          <small style="color:#7a7a7a">(${place.review_count} review)</small>
        </div>
      </div>
      ${place.description ? '<div class="detail-info">' + escapeHtml(place.description) + '</div>' : ''}
      <span class="detail-price">💰 ${escapeHtml(price)}</span>

      <div class="section-title">✍️ Viết review</div>
      <div class="review-form">
        <label>Tên của bạn</label>
        <input id="reviewAuthor" placeholder="Vd: Minh Anh" />
        <label>Đánh giá chung</label>
        <div class="star-input" id="reviewStars">
          <span data-v="1">★</span><span data-v="2">★</span><span data-v="3">★</span><span data-v="4">★</span><span data-v="5">★</span>
        </div>
        <label>Chất lượng đồ ăn (1-5)</label>
        <select id="reviewFood">
          <option value="">— Chọn —</option>
          <option value="5">5 - Tuyệt vời</option>
          <option value="4">4 - Ngon</option>
          <option value="3">3 - Bình thường</option>
          <option value="2">2 - Tạm được</option>
          <option value="1">1 - Kém</option>
        </select>
        <label>Giá tiền hợp lý (1-5)</label>
        <select id="reviewPrice">
          <option value="">— Chọn —</option>
          <option value="5">5 - Rất hợp lý</option>
          <option value="4">4 - Hợp lý</option>
          <option value="3">3 - Chấp nhận được</option>
          <option value="2">2 - Hơi đắt</option>
          <option value="1">1 - Quá đắt</option>
        </select>
        <label>Nhận xét</label>
        <textarea id="reviewComment" rows="3" placeholder="Chia sẻ trải nghiệm của bạn..."></textarea>
        <button class="btn-submit" onclick="submitReview()">Gửi review</button>
      </div>

      <div class="section-title">💬 Review từ cộng đồng (${reviews.length})</div>
      ${reviewsHtml}
    </div>

      <button class="btn-delete-place" onclick="deletePlace(${place.id})">🗑️ Xóa quán này</button>`;

  // Bind star rating
  bindStarInput();
}

let starRating = 0;
function bindStarInput() {
  const container = document.getElementById('reviewStars');
  if (!container) return;
  starRating = 0;
  const spans = container.querySelectorAll('span');
  spans.forEach(s => {
    s.addEventListener('mouseenter', () => highlight(s.dataset.v));
    s.addEventListener('click', () => { starRating = Number(s.dataset.v); highlight(starRating); });
  });
  container.addEventListener('mouseleave', () => highlight(starRating));
  function highlight(v) {
    spans.forEach(s => s.classList.toggle('on', Number(s.dataset.v) <= v));
  }
}

async function submitReview() {
  const author = document.getElementById('reviewAuthor').value.trim();
  const comment = document.getElementById('reviewComment').value.trim();
  const food = document.getElementById('reviewFood').value;
  const price = document.getElementById('reviewPrice').value;

  if (!author) return showToast('⚠️ Vui lòng nhập tên của bạn');
  if (!starRating) return showToast('⚠️ Vui lòng chọn số sao đánh giá');

  try {
    const res = await fetch(API + '/places/' + selectedPlaceId + '/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author, rating: starRating,
        food_quality: food ? Number(food) : null,
        price_value: price ? Number(price) : null,
        comment
      })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Lỗi'); }
    showToast('✅ Review đã được gửi, cảm ơn bạn!');
    openPlace(selectedPlaceId);
    loadPlaces();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  }
}

// ============ Add Place ============
// Điền danh sách tỉnh thành vào form thêm địa điểm
async function populateAddCitySelect() {
  const sel = document.getElementById('addCitySelect');
  if (!sel || sel.options.length > 1) return; // đã điền rồi
  try {
    const res = await fetch(API + '/cities');
    const cities = await res.json();
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error('Lỗi tải danh sách tỉnh thành:', err);
  }
}

function showAddPlaceModal() {
  document.getElementById('addPlaceModal').classList.remove('hidden');
  document.getElementById('addPlaceForm').reset();
  populateAddCitySelect();
}

async function submitPlace(e) {
  e.preventDefault();
  const form = document.getElementById('addPlaceForm');
  const data = Object.fromEntries(new FormData(form).entries());
  data.lat = Number(data.lat);
  data.lng = Number(data.lng);
  data.price_min = data.price_min ? Number(data.price_min) : null;
  data.price_max = data.price_max ? Number(data.price_max) : null;

  try {
    const res = await fetch(API + '/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Lỗi'); }
    const place = await res.json();
    showToast('✅ Đã thêm: ' + place.name);
    document.getElementById('addPlaceModal').classList.add('hidden');
    // refresh city list
    addCityOption(place.city);
    loadPlaces();
    openPlace(place.id);
  } catch (err) {
    showToast('⚠️ ' + err.message);
  }
}

function addCityOption(city) {
  // Sau khi thêm địa điểm ở tỉnh thành mới, reload danh sách thành phố
  loadCities();
}

// ============ Utilities ============
function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}
function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}


// ============ Load Cities ============
async function loadCities() {
  try {
    const res = await fetch(API + '/cities');
    const cities = await res.json();
    const sel = document.getElementById('citySelect');
    // giữ lại thành phố đang chọn hiện tại
    const current = sel.value;
    // giữ nguyên option "all" ở đầu
    sel.innerHTML = '<option value="all">Tất cả tỉnh/thành (' + cities.length + ')</option>';
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      // đánh dấu ● nếu thành phố đó đã có địa điểm
      opt.textContent = c.name + (c.hasPlaces ? ' ●' : '');
      sel.appendChild(opt);
    });
    // khôi phục lựa chọn trước đó nếu còn hợp lệ
    if ([...sel.options].some(o => o.value === current)) {
      sel.value = current;
    }
  } catch (err) {
    console.error('Lỗi tải danh sách thành phố:', err);
  }
}


// ============ Xóa địa điểm (quán phá sản/đóng cửa) ============
async function deletePlace(id) {
  let name = 'quán ăn này';
  try {
    const d = await (await fetch(API + '/places/' + id)).json();
    name = d.place ? d.place.name : name;
  } catch (e) {}

  const msg = 'Bạn có chắc muốn XÓA vĩnh viễn quán "' + name + '" không?' + String.fromCharCode(10) + String.fromCharCode(10) + '⚠️ Hành động này không thể hoàn tác, và toàn bộ review của quán cũng sẽ bị xóa.';
  if (!confirm(msg)) return;

  try {
    const res = await fetch(API + '/places/' + id, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || 'Lỗi khi xóa');
    }
    showToast('✅ Đã xóa: ' + name);
    document.getElementById('detailPanel').classList.add('hidden');
    loadPlaces();
    loadCities();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  }
}


// ============ Tìm bạn đi cùng ============
// Lưu ID đăng ký tìm bạn (dùng localStorage để giữ qua các lần refresh)
let myPartnerId = (() => {
  try {
    const saved = localStorage.getItem('myPartnerId');
    return saved ? Number(saved) : null;
  } catch (e) { return null; }
})();

function openPartnerModal() {
  document.getElementById('partnerModal').classList.remove('hidden');
  loadPartnerList();
}

function closePartnerModal() {
  document.getElementById('partnerModal').classList.add('hidden');
}

// Đăng ký tìm bạn
async function submitPartner(e) {
  e.preventDefault();
  const form = document.getElementById('partnerForm');
  const data = Object.fromEntries(new FormData(form).entries());
  data.age = Number(data.age);

  // Validate format mục tiêu
  if (!validateDestination(data.destination)) {
    showToast('⚠️ Mục tiêu phải theo format: Tên địa điểm (Số nhà Tên đường). Ví dụ: Cafe G-Life (111 Phan Đình Phùng)');
    return;
  }

  // Validate format giờ đi
  if (!validateDepartTime(data.depart_time)) {
    showToast('⚠️ Giờ đi phải theo format: giờ + h + phút (24h). Ví dụ: 20h45, 08h30, 23h59');
    return;
  }

  try {
    const res = await fetch(API + '/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi khi đăng ký');
    }
    const result = await res.json();
    myPartnerId = result.id;
    try { localStorage.setItem('myPartnerId', String(result.id)); } catch (e) {}
    showToast('✅ Đăng ký thành công! ID của bạn: ' + result.id + ' (Tên hiển thị: ' + result.first_name + ')');
    form.reset();
    loadPartnerList();
    // Tự động tải match nếu có ID
    loadPartnerMatches();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  }
}

// Tải danh sách người tìm bạn (chỉ hiện tên + tuổi)
async function loadPartnerList(destFilter) {
  const container = document.getElementById('partnerList');
  const q = destFilter || document.getElementById('partnerDestFilter').value.trim();
  try {
    const params = q ? '?destination=' + encodeURIComponent(q) : '';
    const res = await fetch(API + '/partner' + params);
    const list = await res.json();
    if (!list.length) {
      container.innerHTML = '<p class="list-hint">Chưa có ai đăng ký tìm bạn 😕</p>';
      return;
    }
    container.innerHTML = list.map(p => {
      const name = escapeHtml(p.name); // chỉ TÊN, không họ
      const age = escapeHtml(String(p.age));
      const dest = escapeHtml(p.destination);
      const time = escapeHtml(p.depart_time);
      const date = escapeHtml(p.depart_date);
      return (
        '<div class="partner-card">' +
        '  <div class="pc-top">' +
        '    <span class="pc-name">👤 ' + name + '</span>' +
        '    <span class="pc-age">' + age + ' tuổi</span>' +
        '  </div>' +
        '  <div class="pc-dest">Muốn đến: <strong>' + dest + '</strong></div>' +
        '  <div class="pc-time">🕐 Lúc ' + time + ' · 📅 ' + date + '</div>' +
        '</div>'
      );
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="list-hint">Lỗi tải danh sách</p>';
  }
}

// Xem match (cần nhập ID của mình)
async function loadPartnerMatches() {
  const container = document.getElementById('partnerMatches');
  if (!myPartnerId) {
    container.innerHTML = '<p class="list-hint">Bạn chưa đăng ký tìm bạn. Đăng ký ở mục trên nhé 👆</p>';
    return;
  }
  container.innerHTML = '<p class="list-hint">Đang tải match...</p>';
  try {
    const res = await fetch(API + '/partner/' + myPartnerId + '/matches');
    const data = await res.json();
    if (!data.matches.length) {
      container.innerHTML = '<p class="list-hint">Chưa có match nào. Hãy chờ người có cùng mục tiêu + giờ + ngày đăng ký 🕐</p>';
      return;
    }
    container.innerHTML = data.matches.map(m => (
      '<div class="partner-match-card">' +
      '  <div class="pm-name">🎉 ' + escapeHtml(m.full_name) + ' (' + m.age + ' tuổi)</div>' +
      '  <div class="pm-phone">📞 ' + escapeHtml(m.phone) + '</div>' +
      '  <div class="pm-info">📍 ' + escapeHtml(m.destination) + ' · 🕐 ' + escapeHtml(m.depart_time) + ' · 📅 ' + escapeHtml(m.depart_date) + '</div>' +
      '</div>'
    )).join('');
  } catch (err) {
    container.innerHTML = '<p class="list-hint">Lỗi tải match</p>';
  }
}

// Check match từ ô nhập ID
async function checkPartnerMatch() {
  // Tự dùng myPartnerId đã lưu (không cần nhập ID)
  loadPartnerMatches();
}

// Hủy đăng ký tìm bạn
async function cancelPartnerRegister() {
  // Dùng ID đăng ký đã lưu trong phiên (không cần nhập)
  if (!myPartnerId) {
    showToast('⚠️ Bạn chưa đăng ký tìm bạn trong phiên này. Hãy đăng ký trước rồi mới hủy.');
    return;
  }
  const id = myPartnerId;
  if (!confirm('Bạn có chắc muốn HỦY đăng ký tìm bạn không?\n\n⚠️ Đăng ký và toàn bộ match của bạn sẽ bị xóa.')) return;

  try {
    const res = await fetch(API + '/partner/' + id, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || 'Lỗi khi hủy đăng ký');
    }
    showToast('✅ Đã hủy đăng ký tìm bạn');
    myPartnerId = null;
    try { localStorage.removeItem('myPartnerId'); } catch (e) {}
    loadPartnerList();
    loadPartnerMatches();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  }
}

// Validate format mục tiêu (client-side)
function validateDestination(dest) {
  const m = (dest || '').trim().match(/^(.+?)\s*\((.+)\)$/);
  return !!m && m[1].trim().length > 0 && m[2].trim().length > 0;
}

// Validate format giờ: ddHmm (ví dụ 20h45), giờ 0-23, phút 00-59
function validateDepartTime(t) {
  const m = (t || '').trim().match(/^([0-9]{1,2})[hH]([0-9]{2})$/);
  if (!m) return false;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}


// ============ Event Listeners ============
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadPlaces();
  loadCities();

  // Category chips
  document.getElementById('categoryChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.cat;
    loadPlaces();
  });

  // City select
  document.getElementById('citySelect').addEventListener('change', (e) => {
    activeCity = e.target.value;
    loadPlaces();
  });

  // Price filter (min)
  document.getElementById('priceMinSelect').addEventListener('change', (e) => {
    activePriceMin = e.target.value;
    loadPlaces();
  });

  // Price filter (max)
  document.getElementById('priceMaxSelect').addEventListener('change', (e) => {
    activePriceMax = e.target.value;
    loadPlaces();
  });

  // Search
  document.getElementById('searchBtn').addEventListener('click', loadPlaces);

  // Tìm bạn đi cùng
  document.getElementById('openPartnerBtn').addEventListener('click', openPartnerModal);
  document.getElementById('closePartner').addEventListener('click', closePartnerModal);
  document.getElementById('partnerForm').addEventListener('submit', submitPartner);
  document.getElementById('partnerFilterBtn').addEventListener('click', () => loadPartnerList());
  document.getElementById('partnerDestFilter').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadPartnerList();
  });
  // Đóng modal khi click backdrop
  document.getElementById('partnerModal').addEventListener('click', (e) => {
    if (e.target.id === 'partnerModal') closePartnerModal();
  });
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadPlaces();
  });

  // Add place
  document.getElementById('addPlaceBtn').addEventListener('click', showAddPlaceModal);
  document.getElementById('closeAddPlace').addEventListener('click', () => {
    document.getElementById('addPlaceModal').classList.add('hidden');
  });
  document.getElementById('addPlaceForm').addEventListener('submit', submitPlace);

  // Close detail
  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('detailPanel').classList.add('hidden');
  });

  // Close modal on backdrop click
  document.getElementById('addPlaceModal').addEventListener('click', (e) => {
    if (e.target.id === 'addPlaceModal') e.target.classList.add('hidden');
  });
});

// Expose for inline onclick
window.openPlace = openPlace;
window.submitReview = submitReview;
window.deletePlace = deletePlace;
window.openPartnerModal = openPartnerModal;
window.closePartnerModal = closePartnerModal;
window.submitPartner = submitPartner;
window.checkPartnerMatch = checkPartnerMatch;
window.cancelPartnerRegister = cancelPartnerRegister;
