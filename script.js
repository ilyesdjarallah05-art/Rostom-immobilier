const STORAGE_KEY = 'rostomImmobilierPropertiesV1';
const HIDDEN_DEFAULTS_KEY = 'rostomHiddenDefaultPropertiesV1';
const ADMIN_FLAG = 'rostomAdminUnlocked';
const ADMIN_CODE = 'Rostom2026';
const ROOT = location.pathname.includes('/pages/') || location.pathname.includes('/admin/') ? '../' : './';
let LOCATION_DATA = fallbackLocationData();
let REMOTE_PROPERTIES = null;
let DB_STATUS = 'local';
let ADMIN_EDITING_ID = '';
let ADMIN_EXISTING_IMAGES = [];
let ADMIN_TOUR_ROOMS = [];
let ADMIN_HOTSPOT_ROOM_INDEX = 0;
let ADMIN_SELECTED_POINT = null;
let ADMIN_VIEWER = null;
let ADMIN_ROOM_URLS = [];
let HERO_AUTOPLAY_TIMER = null;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

function showPageLoader(){
  if($('#pageLoader')) return;
  const loader = document.createElement('div');
  loader.id = 'pageLoader';
  loader.className = 'page-loader';
  loader.setAttribute('role','status');
  loader.setAttribute('aria-live','polite');
  loader.innerHTML = '<div class="page-loader-inner"><span class="loader-spinner" aria-hidden="true"></span></div>';
  document.body.appendChild(loader);
}
function hidePageLoader(){
  const loader = $('#pageLoader');
  if(!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(()=>loader.remove(), 260);
}

function savedProperties(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function setSavedProperties(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function hiddenDefaultIds(){ try { return JSON.parse(localStorage.getItem(HIDDEN_DEFAULTS_KEY)) || []; } catch { return []; } }
function setHiddenDefaultIds(items){ localStorage.setItem(HIDDEN_DEFAULTS_KEY, JSON.stringify(Array.from(new Set(items)))); }
function defaultProperties(){ const hidden = new Set(hiddenDefaultIds()); return ROSTOM_DEFAULT_PROPERTIES.filter(p => !hidden.has(p.id)); }
function localProperties(){ return [...savedProperties(), ...defaultProperties()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)); }
function allProperties(){ return (Array.isArray(REMOTE_PROPERTIES) ? REMOTE_PROPERTIES : localProperties()).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)); }
function isAdminScreen(){ return Boolean($('#adminList') || $('#loginScreen') || $('#adminApp')); }
async function refreshAdminProperties(){
  if(!window.RostomDB?.enabled || !window.RostomDB?.isSignedIn?.()) return false;
  try{
    REMOTE_PROPERTIES = window.RostomDB.listAdminProperties
      ? await window.RostomDB.listAdminProperties()
      : await window.RostomDB.listProperties({ published:false, limit:1000 });
    DB_STATUS = 'connected';
    return true;
  }catch(err){
    console.warn('Supabase admin list failed:', err);
    return false;
  }
}
async function loadDatabaseProperties(){
  if(!window.RostomDB?.enabled){ DB_STATUS = 'local'; return; }
  try{
    const detailId = $('#propertyDetail') ? new URL(location.href).searchParams.get('id') : '';
    if(detailId && window.RostomDB.getProperty){
      const one = await window.RostomDB.getProperty(detailId);
      REMOTE_PROPERTIES = one ? [one] : [];
    } else if(isAdminScreen() && window.RostomDB.isSignedIn?.()) {
      await refreshAdminProperties();
    } else {
      REMOTE_PROPERTIES = await window.RostomDB.listProperties({ limit:1000 });
      DB_STATUS = 'connected';
    }
  }catch(err){
    console.warn('Supabase read failed:', err);
    REMOTE_PROPERTIES = null;
    DB_STATUS = 'offline';
  }
}
function usingDatabase(){ return Array.isArray(REMOTE_PROPERTIES) && window.RostomDB?.enabled; }
function clean(v){ return String(v || '').trim(); }
function safeText(v){ return clean(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function safeUrl(v){ const url = clean(v); return /^https?:\/\//i.test(url) ? url.replace(/"/g,'%22') : ''; }
function imageSrc(v){
  let url = clean(v);
  if(!url) return '';
  if(/^(javascript:|vbscript:|data:(?!image\/))/i.test(url)) return '';
  if(window.RostomDB?.enabled && /^(photos|tours)\//i.test(url)){
    url = window.RostomDB.publicStorageUrl(url);
  }
  return url.replace(/"/g,'%22');
}
function extractImageList(value){
  if(!value) return [];
  if(Array.isArray(value)) return value.flatMap(extractImageList);
  if(typeof value === 'object') return extractImageList(value.url || value.src || value.publicUrl || value.path || value.image);
  const raw = clean(value);
  if(!raw) return [];
  if((raw.startsWith('[') || raw.startsWith('{'))){
    try { return extractImageList(JSON.parse(raw)); } catch {}
  }
  return raw.split(/\s*,\s*/).filter(Boolean);
}
function firstImage(p){
  const candidates = [p?.images, p?.image, p?.mainImage, p?.coverImage, p?.photo, p?.photos, p?.gallery].flatMap(extractImageList);
  return imageSrc(candidates.find(Boolean) || '');
}
function cssUrl(v){ return imageSrc(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n|\r/g,''); }
function propertyUrl(id){ return `${ROOT}pages/property.html?id=${encodeURIComponent(id)}`; }
function langLocale(){ return currentLang()==='ar' ? 'ar-DZ' : currentLang()==='fr' ? 'fr-DZ' : 'en-DZ'; }
function formatPrice(p){ const n = Number(String(p||'').replace(/\s/g,'')); return Number.isNaN(n) ? safeText(p) : new Intl.NumberFormat(langLocale()).format(n); }
function statusLabel(status){ return status === 'rent' ? t('card.forRent') : status === 'new' ? t('card.new') : t('card.forSale'); }
function catLabel(cat){ return {estates:t('cat.estates'),houses:t('cat.houses'),apartments:t('cat.apartments'),villas:t('cat.villas'),land:t('cat.land'),offices:t('cat.offices'),commercial:t('cat.commercial')}[cat] || t('cat.estates'); }
function wilayaDisplay(value){
  const code = clean(value).split(' - ')[0];
  const w = LOCATION_DATA.wilayas.find(x => x.code === code);
  return w ? `${w.code} - ${locationLabel(w, currentLang())}` : safeText(value);
}


function roomHotspotTooltip(hotSpotDiv, args){
  hotSpotDiv.classList.add('room-hotspot');
  const label = document.createElement('span');
  label.className = 'room-hotspot-label';
  label.textContent = clean(args?.text || args || 'Room');
  hotSpotDiv.appendChild(label);
}

function normalizeHotspots(list){
  return (Array.isArray(list) ? list : []).map(h => {
    const pitch = Number(h.pitch), yaw = Number(h.yaw), targetRoom = Number(h.targetRoom);
    return { pitch, yaw, text: clean(h.text) || 'Go', targetRoom: Number.isFinite(targetRoom) ? targetRoom : 0 };
  }).filter(h => Number.isFinite(h.pitch) && Number.isFinite(h.yaw));
}
function normalizeTourRooms(p){
  const rawRooms = Array.isArray(p?.virtualTourRooms) ? p.virtualTourRooms : (Array.isArray(p?.virtual_tour_rooms) ? p.virtual_tour_rooms : []);
  return rawRooms.map((r,i)=>({
    room: clean(r.room) || `${t('detail.tourRoom')} ${i+1}`,
    image: imageSrc(r.image),
    hotspots: normalizeHotspots(r.hotspots)
  })).filter(r=>r.image);
}
function hasVirtualTour(p){
  return Boolean(
    truthyFlag(p?.hasVirtualTour) ||
    truthyFlag(p?.has_virtual_tour) ||
    clean(p?.virtualTourUrl) ||
    clean(p?.virtual_tour_url) ||
    normalizeTourRooms(p).length
  );
}
function roomNamesFromText(text){ return clean(text).split(/\n|,/).map(clean).filter(Boolean); }
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); }); }
async function filesToUrls(files, folder){
  const list = Array.from(files || []);
  if(!list.length) return [];
  if(window.RostomDB?.enabled && window.RostomDB?.isSignedIn?.()){
    const uploaded = await window.RostomDB.uploadFiles(list, folder);
    return uploaded.map(item => item.publicUrl);
  }
  return Promise.all(list.map(fileToDataUrl));
}
async function roomImageToUrl(room){
  if(room.file){
    if(window.RostomDB?.enabled && window.RostomDB?.isSignedIn?.()){
      const uploaded = await window.RostomDB.uploadFile(room.file, 'tours');
      return uploaded.publicUrl;
    }
    return await fileToDataUrl(room.file);
  }
  return imageSrc(room.image);
}

function populateWilayaSelect(sel){
  const first = sel.querySelector('option')?.outerHTML || '';
  const current = sel.value;
  sel.innerHTML = first + LOCATION_DATA.wilayas.map(w=>`<option value="${safeText(wilayaValue(w))}">${safeText(w.code)} - ${safeText(locationLabel(w,currentLang()))}</option>`).join('');
  if(current) sel.value = current;
}
function fillWilayaSelects(){ $$('[data-wilayas]').forEach(populateWilayaSelect); }
function communeListForWilaya(wilaya){ return LOCATION_DATA.communesByWilaya[wilaya] || []; }
function fillCommuneControl(control, wilaya, selected=''){
  if(!control) return;
  const list = communeListForWilaya(wilaya);
  const isDatalist = control.tagName === 'DATALIST';
  if(isDatalist){
    control.innerHTML = list.map(c=>`<option value="${safeText(c.fr)}">${safeText(locationLabel(c,currentLang()))}</option>`).join('');
    return;
  }
  const firstLabel = wilaya ? t('search.allAreas') : t('filter.areaDisabled');
  control.innerHTML = `<option value="">${safeText(firstLabel)}</option>` + list.map(c=>`<option value="${safeText(c.fr)}">${safeText(locationLabel(c,currentLang()))}</option>`).join('');
  control.disabled = !wilaya;
  if(selected) control.value = selected;
}
function bindLocationControls(){
  $$('[data-wilaya-source]').forEach(wilayaSel => {
    const target = $(wilayaSel.dataset.wilayaSource);
    const update = () => fillCommuneControl(target, wilayaSel.value, target?.dataset.keepValue || '');
    if(target) { update(); wilayaSel.addEventListener('change', update); }
  });
  $$('[data-communes-for]').forEach(control => {
    const source = $(control.dataset.communesFor);
    if(source) fillCommuneControl(control, source.value);
  });
}

function initNav(){
  const nav = $('#nav');
  if(nav) window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>30),{passive:true});
  const menu = $('#menuBtn');
  const links = $('#navLinks');
  if(menu && links) menu.addEventListener('click',()=>{
    links.classList.toggle('open');
    menu.classList.toggle('open');
    menu.textContent = links.classList.contains('open') ? t('nav.close') : t('nav.menu');
  });
  const current = location.pathname.split('/').pop() || 'index.html';
  $$('[data-page]').forEach(a => { if(a.dataset.page === current || (current === 'index.html' && a.dataset.page === 'home')) a.classList.add('active'); });
}
function initReveal(){
  const items = $$('.reveal');
  if(!items.length) return;
  const obs = new IntersectionObserver(entries=>entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); }),{threshold:.08,rootMargin:'0px 0px -40px 0px'});
  items.forEach((el,i)=>{ el.style.transitionDelay = `${Math.min(i%8,5)*55}ms`; obs.observe(el); });
}
function initCardMotion(){
  $$('.property-card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX-r.left)/r.width)*100}%`);
      card.style.setProperty('--my', `${((e.clientY-r.top)/r.height)*100}%`);
    });
  });
}

let PANNELLUM_LOAD_PROMISE = null;
function loadPannellumAssets(){
  if(window.pannellum) return Promise.resolve(true);
  if(PANNELLUM_LOAD_PROMISE) return PANNELLUM_LOAD_PROMISE;
  PANNELLUM_LOAD_PROMISE = new Promise((resolve, reject)=>{
    if(!document.querySelector('link[data-pannellum-css]')){
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
      link.dataset.pannellumCss = 'true';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Could not load 360 viewer. Check your internet connection.'));
    document.body.appendChild(script);
  });
  return PANNELLUM_LOAD_PROMISE;
}

function buildCard(p){
  const img = firstImage(p);
  const price = p.price ? `${formatPrice(p.price)} ${safeText(p.currency || 'DZD')}` : '';
  const roomsValue = p.bedrooms || p.rooms;
  const areaValue = p.surface || p.landSurface;
  const has360 = hasVirtualTour(p);
  const meta = [
    roomsValue && { icon:'bed', text: safeText(roomsValue) },
    p.bathrooms && { icon:'bath', text: safeText(p.bathrooms) },
    areaValue && { icon:'area', text: `${safeText(areaValue)} ${safeText(t('card.surface'))}` }
  ].filter(Boolean).map(m=>`<span>${cardIcon(m.icon)}${m.text}</span>`).join('');
  return `<article class="property-card reveal ${has360 ? 'has-360' : ''}" data-category="${safeText(p.category)}" data-status="${safeText(p.status)}" data-wilaya="${safeText(p.wilaya)}" data-commune="${safeText(p.commune)}">
    <a href="${propertyUrl(p.id)}" class="prop-media" aria-label="${safeText(t('card.details'))}">
      ${img ? `<img src="${img}" alt="${safeText(p.title || t('property.generic'))}" loading="lazy">` : '<div class="no-img"></div>'}
      <span class="badge ${p.status==='rent'?'rent':p.status==='new'?'new':''}">${safeText(statusTypeLabel(p))}</span>
      ${has360 ? `<span class="tour-pill" aria-label="${safeText(t('card.tour'))}">${safeText(t('card.tour'))}</span>` : ''}
      <span class="explore-dot">${safeText(t('card.details'))} →</span>
    </a>
    <div class="prop-body">
      <div class="prop-topline"><span>${safeText(statusTypeLabel(p))}</span><span>${safeText(wilayaDisplay(p.wilaya))}</span></div>
      <h3 class="prop-title">${safeText(p.title || t('property.generic'))}</h3>
      <p class="location prop-location-line">${cardIcon('pin')}<span>${propertyLocation(p)}</span></p>
      ${price ? `<p class="price">${price}</p>` : ''}
      ${meta ? `<div class="meta icon-meta">${meta}</div>` : ''}
    </div>
  </article>`;
}
function renderCards(container, properties){
  if(!container) return;
  container.innerHTML = properties.length ? properties.map(buildCard).join('') : `<div class="empty">${safeText(t('empty'))}</div>`;
  initReveal(); initCardMotion();
}


function truthyFlag(v){
  return v === true || v === 1 || ['true','1','yes','on'].includes(String(v || '').toLowerCase());
}
function heroOrderValue(p){
  const n = Number(p?.heroOrder);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}
function uniqueProperties(list){
  const seen = new Set();
  return list.filter(p => {
    const key = clean(p?.id) || clean(p?.title) || JSON.stringify(p);
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function heroSliderProperties(){
  const items = uniqueProperties(allProperties());
  const byOrder = list => [...list].sort((a,b)=>{
    const ao = heroOrderValue(a) ?? 999, bo = heroOrderValue(b) ?? 999;
    if(ao !== bo) return ao - bo;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const newest = list => [...list].sort((a,b)=>new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const isSelected = p => p && (truthyFlag(p.heroFeatured) || truthyFlag(p.showInHero) || truthyFlag(p.homeHero));
  const hasHeroImage = p => Boolean(firstImage(p));

  const selectedRaw = byOrder(items.filter(isSelected));

  // Admin-selected slider is now strict and predictable:
  // property must be selected, have order 1–8, and have an image.
  // This prevents old/empty selected rows from creating white slides.
  const selectedWithOrderAndImage = selectedRaw.filter(p => heroOrderValue(p) && hasHeroImage(p)).slice(0,8);
  if(selectedWithOrderAndImage.length){
    window.__rostomHeroDebug = { mode:'admin_ordered', count:selectedWithOrderAndImage.length, selectedInDatabase:selectedRaw.length, items:selectedWithOrderAndImage.map(p=>({id:p.id,title:p.title,heroFeatured:p.heroFeatured,heroOrder:p.heroOrder,image:firstImage(p)})) };
    return selectedWithOrderAndImage;
  }

  // If there are selected rows but no valid ordered image rows, do NOT complete to 8.
  // Show only selected rows that actually have images.
  if(selectedRaw.length){
    const selectedWithImage = selectedRaw.filter(hasHeroImage).slice(0,8);
    window.__rostomHeroDebug = { mode:'admin_selected_without_valid_order', count:selectedWithImage.length, selectedInDatabase:selectedRaw.length, items:selectedWithImage.map(p=>({id:p.id,title:p.title,heroFeatured:p.heroFeatured,heroOrder:p.heroOrder,image:firstImage(p)})) };
    return selectedWithImage;
  }

  // Only when the admin selected nothing, use a safe fallback list with images.
  const fallback = newest(items.filter(hasHeroImage)).slice(0,8);
  window.__rostomHeroDebug = { mode:'fallback_no_admin_selection', count:fallback.length, selectedInDatabase:0, items:fallback.map(p=>({id:p.id,title:p.title,heroFeatured:p.heroFeatured,heroOrder:p.heroOrder,image:firstImage(p)})) };
  return fallback;
}
function heroBackgroundImage(p){
  const img = firstImage(p);
  return cssUrl(img || 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1800&q=80');
}
function buildHeroSlide(p, index){
  const img = heroBackgroundImage(p);
  const price = p.price ? `${formatPrice(p.price)} ${safeText(p.currency || 'DZD')}` : '';
  const roomsValue = p.bedrooms || p.rooms;
  const areaValue = p.surface || p.landSurface;
  const details = [
    roomsValue && `${cardIcon('bed')}<span>${safeText(roomsValue)}</span>`,
    p.bathrooms && `${cardIcon('bath')}<span>${safeText(p.bathrooms)}</span>`,
    areaValue && `${cardIcon('area')}<span>${safeText(areaValue)} ${safeText(t('card.surface'))}</span>`
  ].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
  return `<article class="home-slide ${index===0?'active':''}" style="background-image:url('${img}')">
    <div class="container home-slide-content">
      <a class="hero-property-card" href="${propertyUrl(p.id)}">
        <p class="hero-status">${safeText(statusTypeLabel(p))}</p>
        <h1>${safeText(p.title || t('property.generic'))}${price ? ` | ${price}` : ''}</h1>
        ${details ? `<div class="hero-specs">${details}</div>` : ''}
        <p class="hero-place">${cardIcon('pin')}<span>${propertyLocation(p)}</span></p>
        ${price ? `<p class="hero-price">${price}</p>` : ''}
      </a>
    </div>
  </article>`;
}
function initHeroSlider(){
  const slider = $('#homeSlider');
  if(!slider) return;
  const dotsWrap = $('#heroDots');
  const items = heroSliderProperties();
  if(HERO_AUTOPLAY_TIMER) clearInterval(HERO_AUTOPLAY_TIMER);
  if(!items.length){ slider.innerHTML = ''; if(dotsWrap) dotsWrap.innerHTML = ''; return; }
  slider.innerHTML = items.map(buildHeroSlide).join('');
  if(dotsWrap) dotsWrap.innerHTML = items.map((_,i)=>`<button class="hero-dot ${i===0?'active':''}" type="button" aria-label="${safeText(t('gallery.goToProperty'))} ${i+1}" data-hero-dot="${i}"></button>`).join('');
  const slides = $$('.home-slide', slider);
  const dots = $$('[data-hero-dot]');
  let index = 0;
  function go(next){
    index = (next + slides.length) % slides.length;
    slider.style.transform = `translateX(${-index * 100}%)`;
    slides.forEach((slide,i)=>slide.classList.toggle('active', i === index));
    dots.forEach((dot,i)=>dot.classList.toggle('active', i === index));
  }
  $('#heroPrev') && ($('#heroPrev').onclick = () => go(index - 1));
  $('#heroNext') && ($('#heroNext').onclick = () => go(index + 1));
  dots.forEach(dot=>dot.onclick = () => go(Number(dot.dataset.heroDot)));
  if(slides.length > 1){
    HERO_AUTOPLAY_TIMER = setInterval(()=>go(index + 1), 5200);
    const hero = $('#homeHero');
    if(hero){
      hero.onmouseenter = () => HERO_AUTOPLAY_TIMER && clearInterval(HERO_AUTOPLAY_TIMER);
      hero.onmouseleave = () => { HERO_AUTOPLAY_TIMER && clearInterval(HERO_AUTOPLAY_TIMER); HERO_AUTOPLAY_TIMER = setInterval(()=>go(index + 1), 5200); };
    }
  }
}
function initListings(){
  const grid = $('#listingsGrid'); if(!grid) return;
  const fixedCategory = grid.dataset.category || '';
  const limit = Number(grid.dataset.limit || 0);
  const featuredOnly = grid.dataset.featured === 'true';
  const apply = () => {
    const q = clean($('#searchText')?.value).toLowerCase();
    const status = $('#filterStatus')?.value || '';
    const cat = fixedCategory || ($('#filterCategory')?.value || new URL(location.href).searchParams.get('category') || '');
    const wilaya = $('#filterWilaya')?.value || '';
    const commune = $('#filterCommune')?.value || '';
    const maxPrice = Number(new URL(location.href).searchParams.get('maxPrice') || 0);
    let items = allProperties().filter(p => {
      const hay = [p.title,p.description,p.wilaya,p.commune,p.address,catLabel(p.category),statusTypeLabel(p)].join(' ').toLowerCase();
      const priceValue = Number(String(p.price || '').replace(/\s/g,''));
      const priceOk = !maxPrice || (!Number.isNaN(priceValue) && priceValue <= maxPrice);
      return (!q || hay.includes(q)) && (!status || p.status === status) && (!cat || p.category === cat) && (!wilaya || p.wilaya === wilaya) && (!commune || p.commune === commune) && priceOk && (!featuredOnly || p.featured);
    });
    if(limit) items = items.slice(0, limit);
    renderCards(grid, items);
  };
  if(!grid.dataset.filtersBound){
    ['input','change'].forEach(ev=>$$('[data-filter]').forEach(el=>el.addEventListener(ev, apply)));
    $$('#quickChips .chip').forEach(chip=>chip.addEventListener('click',()=>{ $$('#quickChips .chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active'); const target = chip.dataset.status || ''; const statusInput = $('#filterStatus'); if(statusInput) statusInput.value = target; apply(); }));
    grid.dataset.filtersBound = 'yes';
  }
  apply();
}
function initSearchBox(){
  const btn = $('#homeSearchBtn'); if(!btn) return;
  btn.addEventListener('click',()=>{
    const params = new URLSearchParams();
    const q = clean($('#homeSearch')?.value); const status = $('#homeStatus')?.value; const category = $('#homeCategory')?.value; const wilaya = $('#homeWilaya')?.value; const price = $('#homePrice')?.value;
    if(q) params.set('q', q); if(status) params.set('status', status); if(category) params.set('category', category); if(wilaya) params.set('wilaya', wilaya); if(price) params.set('maxPrice', price);
    location.href = `${ROOT}pages/estates.html?${params.toString()}`;
  });
}
function applyUrlFilters(){
  const url = new URL(location.href);
  if($('#searchText') && url.searchParams.get('q')) $('#searchText').value = url.searchParams.get('q');
  if($('#filterStatus') && url.searchParams.get('status')) $('#filterStatus').value = url.searchParams.get('status');
  if($('#filterWilaya') && url.searchParams.get('wilaya')) $('#filterWilaya').value = url.searchParams.get('wilaya');
  if($('#filterCategory') && url.searchParams.get('category')) $('#filterCategory').value = url.searchParams.get('category');
  if($('#filterCommune') && url.searchParams.get('commune')) $('#filterCommune').dataset.keepValue = url.searchParams.get('commune');
}

function buildVirtualTourSection(p){
  const rooms = normalizeTourRooms(p);
  const external = safeUrl(p.virtualTourUrl);
  if(!rooms.length && !external) return '';
  const roomButtons = rooms.map((room,i)=>`<button class="tour-room ${i===0?'active':''}" type="button" data-tour-room="${i}">${safeText(room.room)}</button>`).join('');
  const externalBtn = external ? `<a class="btn-outline" href="${external}" target="_blank" rel="noopener">${safeText(t('detail.tourExternal'))}</a>` : '';
  const viewer = rooms.length ? `<div class="tour-shell"><button class="btn tour-start" type="button" data-tour-start>${safeText(t('detail.tourStart'))}</button><div class="tour-viewer hidden" id="tourViewer"></div></div>${roomButtons ? `<div class="tour-tabs">${roomButtons}</div>` : ''}` : '';
  return `<section class="tour-panel glass info-block"><div class="tour-head"><div><p class="eyebrow">${safeText(t('card.tour'))}</p><h2 class="prop-title">${safeText(t('detail.virtualTour'))}</h2><p class="sub">${safeText(t('detail.tourHelp'))}</p></div>${externalBtn}</div>${viewer}</section>`;
}
function initVirtualTour(p){
  const viewerEl = $('#tourViewer');
  const start = $('[data-tour-start]');
  if(!viewerEl || !start) return;
  const rooms = normalizeTourRooms(p);
  let viewer = null;
  async function loadRoom(index){
    const room = rooms[index]; if(!room) return;
    viewerEl.classList.remove('hidden'); start.classList.add('hidden');
    viewerEl.innerHTML = `<div class="tour-loading">${safeText(t('tour.loading'))}</div>`;
    $$('.tour-room').forEach(btn=>btn.classList.toggle('active', Number(btn.dataset.tourRoom) === index));
    try{ await loadPannellumAssets(); }catch(err){ console.warn(err); }
    if(window.pannellum){
      try { if(viewer && viewer.destroy) viewer.destroy(); } catch {}
      viewerEl.innerHTML = '';
      const hotSpots = (room.hotspots || []).filter(h => rooms[h.targetRoom]).map(h => {
        const label = `${h.text || rooms[h.targetRoom].room} → ${rooms[h.targetRoom].room}`;
        return {
          pitch: h.pitch,
          yaw: h.yaw,
          type: 'info',
          cssClass: 'room-hotspot',
          text: label,
          createTooltipFunc: roomHotspotTooltip,
          createTooltipArgs: { text: label },
          clickHandlerFunc: function(){ loadRoom(h.targetRoom); }
        };
      });
      viewer = pannellum.viewer('tourViewer', { type:'equirectangular', panorama: room.image, autoLoad:true, showControls:true, compass:false, mouseZoom:true, keyboardZoom:true, hfov:105, hotSpots });
    } else {
      viewerEl.innerHTML = `<img src="${safeText(room.image)}" alt="${safeText(room.room)}">`;
    }
  }
  start.addEventListener('click',()=>loadRoom(0));
  $$('.tour-room').forEach(btn=>btn.addEventListener('click',()=>loadRoom(Number(btn.dataset.tourRoom))));
}

function buildPropertyGallery(p){
  const images = extractImageList([p.images, p.image, p.mainImage, p.coverImage, p.photo, p.photos, p.gallery]).map(imageSrc).filter(Boolean);
  if(!images.length) return `<div class="detail-image detail-main-photo empty-photo"></div>`;
  const thumbs = images.map((img,i)=>`<button class="gallery-thumb ${i===0?'active':''}" type="button" data-gallery-index="${i}" aria-label="${safeText(t('gallery.photo'))} ${i+1}"><img src="${img}" alt="${safeText(p.title || t('gallery.photo'))} ${i+1}" loading="lazy"></button>`).join('');
  return `<div class="detail-image detail-main-photo" id="detailMainPhoto" role="button" tabindex="0" aria-label="${safeText(t('property.openGallery'))}"><img id="detailMainImage" src="${images[0]}" alt="${safeText(p.title || t('property.generic'))}" data-gallery-index="0"></div>${images.length > 1 ? `<div class="gallery">${thumbs}</div>` : ''}`;
}
function initPropertyGallery(images){
  images = (images || []).map(imageSrc).filter(Boolean);
  const main = $('#detailMainImage');
  const mainBox = $('#detailMainPhoto');
  if(!main || !mainBox || !images.length) return;
  let current = 0;
  function setCurrent(index){
    current = (index + images.length) % images.length;
    main.src = images[current];
    main.dataset.galleryIndex = current;
    $$('.gallery-thumb').forEach(btn=>btn.classList.toggle('active', Number(btn.dataset.galleryIndex) === current));
  }
  $$('.gallery-thumb').forEach(btn=>btn.addEventListener('click',()=>setCurrent(Number(btn.dataset.galleryIndex))));
  function openLightbox(){
    let startX = 0;
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.innerHTML = `<button class="lightbox-close" type="button" aria-label="${safeText(t('general.close'))}">×</button><button class="lightbox-nav lightbox-prev" type="button" aria-label="${safeText(t('general.previous'))}">‹</button><img class="lightbox-img" src="${images[current]}" alt=""><button class="lightbox-nav lightbox-next" type="button" aria-label="${safeText(t('general.next'))}">›</button><div class="lightbox-count"></div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const img = $('.lightbox-img', overlay), count = $('.lightbox-count', overlay);
    const show = (index) => { current = (index + images.length) % images.length; img.src = images[current]; count.textContent = `${current+1} / ${images.length}`; setCurrent(current); };
    $('.lightbox-close', overlay).addEventListener('click', close);
    $('.lightbox-prev', overlay).addEventListener('click', ()=>show(current-1));
    $('.lightbox-next', overlay).addEventListener('click', ()=>show(current+1));
    overlay.addEventListener('click', e=>{ if(e.target === overlay) close(); });
    overlay.addEventListener('touchstart', e=>{ startX = e.changedTouches[0].clientX; }, {passive:true});
    overlay.addEventListener('touchend', e=>{ const dx = e.changedTouches[0].clientX - startX; if(Math.abs(dx)>45) show(current + (dx < 0 ? 1 : -1)); }, {passive:true});
    function onKey(e){ if(e.key==='Escape') close(); if(e.key==='ArrowLeft') show(current-1); if(e.key==='ArrowRight') show(current+1); }
    function close(){ document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; overlay.remove(); }
    document.addEventListener('keydown', onKey);
    show(current);
  }
  mainBox.addEventListener('click', openLightbox);
  mainBox.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(); } });
}

function initPropertyDetail(){
  const wrap = $('#propertyDetail'); if(!wrap) return;
  const id = new URL(location.href).searchParams.get('id');
  const p = allProperties().find(x=>x.id === id);
  if(!p){
    if(window.RostomDB?.enabled && REMOTE_PROPERTIES === null){
      wrap.innerHTML = `<div class="detail-loading"><span class="loader-spinner" aria-hidden="true"></span></div>`;
      return;
    }
    wrap.innerHTML = `<div class="empty">${safeText(t('detail.notFound'))}</div>`;
    return;
  }
  document.title = `${p.title || t('property.generic')} — Rostom Immobilier`;
  const price = p.price ? `${formatPrice(p.price)} ${safeText(p.currency || 'DZD')}` : '';
  const details = [
    [t('detail.type'), catLabel(p.category)], [t('detail.status'), statusTypeLabel(p)], [t('detail.virtualTour'), hasVirtualTour(p) ? t('detail.tourStart') : ''], [t('detail.wilaya'), wilayaDisplay(p.wilaya)], [t('detail.commune'), p.commune], [t('detail.address'), p.address], [t('detail.price'), price], [t('detail.surface'), p.surface && `${p.surface} ${t('card.surface')}`], [t('detail.land'), p.landSurface && `${p.landSurface} ${t('card.surface')}`], [t('detail.rooms'), p.rooms], [t('detail.bedrooms'), p.bedrooms], [t('detail.bathrooms'), p.bathrooms], [t('detail.floor'), p.floor], [t('detail.year'), p.yearBuilt], [t('detail.phone'), p.phone]
  ].filter(([,v])=>clean(v)).map(([k,v])=>`<div class="detail-item"><small>${safeText(k)}</small><strong>${safeText(v)}</strong></div>`).join('');
  const features = (p.features || []).filter(Boolean).map(f=>`<li>${safeText(f)}</li>`).join('');
  const virtualTour = buildVirtualTourSection(p);
  wrap.innerHTML = `<div class="detail-grid detail-grid-v10">
    <section class="detail-media-col">
      ${buildPropertyGallery(p)}
    </section>
    <aside class="detail-side glass">
      <p class="eyebrow">${safeText(statusTypeLabel(p))}</p>
      <h1 class="title">${safeText(p.title || t('property.generic'))}</h1>
      ${price ? `<p class="price detail-price">${price}</p>` : ''}
      <p class="location detail-location">${[p.commune,wilayaDisplay(p.wilaya)].filter(Boolean).map(safeText).join(' · ')}</p>
      <div class="detail-list">${details}</div>
      <div class="hero-cta"><a class="btn" href="${ROOT}pages/contact.html">${safeText(t('detail.visit'))}</a>${p.phone ? `<a class="btn-outline" href="tel:${safeText(p.phone)}">${safeText(t('detail.call'))}</a>` : ''}</div>
    </aside>
    <section class="detail-info-col">
      ${p.description ? `<div class="glass info-block"><h2 class="prop-title">${safeText(t('detail.description'))}</h2><p class="sub">${safeText(p.description)}</p></div>` : ''}
      ${features ? `<div class="glass info-block"><h2 class="prop-title">${safeText(t('detail.features'))}</h2><ul class="check-list">${features}</ul></div>` : ''}
    </section>
    ${virtualTour ? `<section class="detail-tour-col">${virtualTour}</section>` : ''}
  </div>`;
  initPropertyGallery(extractImageList([p.images, p.image, p.mainImage, p.coverImage, p.photo, p.photos, p.gallery]));
  initVirtualTour(p);
}

function initContactForm(){
  const form = $('#contactForm'); if(!form) return;
  form.addEventListener('submit', e=>{ e.preventDefault(); showToast(t('contact.sent')); form.reset(); });
}
function showToast(msg){ const old = $('.toast'); if(old) old.remove(); const tdiv = document.createElement('div'); tdiv.className='toast'; tdiv.textContent = msg; document.body.appendChild(tdiv); setTimeout(()=>tdiv.remove(),3600); }

function ensureAdminHelpers(){
  const form = $('#propertyForm'); if(!form) return;
  if(!$('#existingImages')){
    const photos = $('#images')?.closest('.field');
    photos?.insertAdjacentHTML('afterend', `<div class="field full"><div id="existingImages" class="media-manager"></div></div>`);
  }
  if(!$('#tourBuilder')){
    const tourUrl = $('[name="virtualTourUrl"]')?.closest('.field');
    tourUrl?.insertAdjacentHTML('afterend', `<div class="field full"><div class="tour-builder" id="tourBuilder">
      <div class="tour-builder-head"><div><h3>${safeText(t('admin.hotspotsTitle'))}</h3><p class="note">${safeText(t('admin.hotspotsHelp'))}</p></div><button class="btn-soft" id="addTourRoomBtn" type="button">${safeText(t('admin.addRoom'))}</button></div>
      <div class="tour-room-editor-grid" id="tourRoomEditorGrid"></div>
      <div class="hotspot-editor hidden" id="hotspotEditor">
        <div class="hotspot-editor-head"><div><p class="eyebrow">360</p><h3 id="hotspotRoomTitle">${safeText(t('detail.tourRoom'))}</h3><p class="note">${safeText(t('admin.clickPanorama'))}</p></div><button class="btn-outline" id="closeHotspotEditor" type="button">${safeText(t('admin.closeEditor'))}</button></div>
        <div class="hotspot-layout"><div class="admin-pano-wrap"><div id="adminTourViewer" class="admin-tour-viewer"></div></div><div class="hotspot-side">
          <div class="field"><label>${safeText(t('admin.hotspotLabel'))}</label><input id="hotspotLabel" type="text" placeholder="${safeText(t('admin.hotspotPlaceholder'))}"></div>
          <div class="field"><label>${safeText(t('admin.targetRoom'))}</label><select id="hotspotTargetRoom"></select></div>
          <div class="hotspot-coords"><span>${safeText(t('admin.selectedPoint'))}</span><strong id="hotspotCoords">—</strong></div>
          <button class="btn" id="addHotspotBtn" type="button">${safeText(t('admin.addHotspot'))}</button>
          <div class="hotspot-list" id="hotspotList"></div>
        </div></div>
      </div>
    </div></div>`);
  }
  if(!$('#cancelEditBtn')){
    const submit = form.querySelector('button[type="submit"]');
    submit?.insertAdjacentHTML('beforebegin', `<button class="btn-outline full hidden" id="cancelEditBtn" type="button">${safeText(t('admin.cancelEdit'))}</button>`);
  }
}
function renderImageManager(){
  const box = $('#existingImages'); if(!box) return;
  const images = ADMIN_EXISTING_IMAGES.map(imageSrc).filter(Boolean);
  box.innerHTML = images.length ? `<p class="mini-label">${safeText(t('admin.currentPhotos'))}</p><div class="media-chips">${images.map((img,i)=>`<div class="media-chip"><img src="${img}" alt=""><button type="button" data-remove-image="${i}">×</button></div>`).join('')}</div>` : '';
  $$('[data-remove-image]').forEach(btn=>btn.addEventListener('click',()=>{ ADMIN_EXISTING_IMAGES.splice(Number(btn.dataset.removeImage),1); renderImageManager(); }));
}
function syncTourNamesFromTextarea(){
  const names = roomNamesFromText($('[name="tourRooms"]')?.value || '');
  if(!names.length) return;
  ADMIN_TOUR_ROOMS.forEach((room,i)=>{ if(names[i]) room.room = names[i]; });
}
function renderTourBuilder(){
  const grid = $('#tourRoomEditorGrid'); if(!grid) return;
  syncTourNamesFromTextarea();
  grid.innerHTML = ADMIN_TOUR_ROOMS.length ? ADMIN_TOUR_ROOMS.map((room,i)=>`<div class="tour-edit-card ${i===ADMIN_HOTSPOT_ROOM_INDEX?'active':''}">
    <img src="${imageSrc(room.image)}" alt="">
    <div class="field"><label>${safeText(t('detail.tourRoom'))} ${i+1}</label><input data-room-name="${i}" type="text" value="${safeText(room.room)}"></div>
    <div class="tour-edit-actions"><button class="btn-soft" type="button" data-edit-hotspots="${i}">${safeText(t('admin.editHotspots'))}</button><button class="btn-soft btn-danger" type="button" data-remove-room="${i}">${safeText(t('admin.remove'))}</button></div>
    <small>${(room.hotspots||[]).length} ${safeText(t('admin.hotspots'))}</small>
  </div>`).join('') : `<div class="empty">${safeText(t('admin.noTourRooms'))}</div>`;
  $$('[data-room-name]').forEach(input=>input.addEventListener('input',()=>{ const i=Number(input.dataset.roomName); if(ADMIN_TOUR_ROOMS[i]) ADMIN_TOUR_ROOMS[i].room = input.value; updateTourRoomsTextarea(); renderHotspotControls(); }));
  $$('[data-remove-room]').forEach(btn=>btn.addEventListener('click',()=>{ ADMIN_TOUR_ROOMS.splice(Number(btn.dataset.removeRoom),1); ADMIN_HOTSPOT_ROOM_INDEX = Math.max(0, Math.min(ADMIN_HOTSPOT_ROOM_INDEX, ADMIN_TOUR_ROOMS.length-1)); updateTourRoomsTextarea(); renderTourBuilder(); openHotspotEditor(ADMIN_HOTSPOT_ROOM_INDEX, false); }));
  $$('[data-edit-hotspots]').forEach(btn=>btn.addEventListener('click',()=>openHotspotEditor(Number(btn.dataset.editHotspots), true)));
  renderHotspotControls();
}
function updateTourRoomsTextarea(){ const area = $('[name="tourRooms"]'); if(area) area.value = ADMIN_TOUR_ROOMS.map(r=>r.room).join('\n'); }
function addTourFiles(files){
  Array.from(files || []).forEach((file, index)=>{
    const image = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').trim();
    ADMIN_TOUR_ROOMS.push({ room: name || `${t('detail.tourRoom')} ${ADMIN_TOUR_ROOMS.length+1}`, image, file, hotspots: [] });
    ADMIN_ROOM_URLS.push(image);
  });
  updateTourRoomsTextarea(); renderTourBuilder();
}
function destroyAdminViewer(){ try{ if(ADMIN_VIEWER?.destroy) ADMIN_VIEWER.destroy(); }catch{} ADMIN_VIEWER = null; }
function openHotspotEditor(index, scroll=false){
  const editor = $('#hotspotEditor'); if(!editor || !ADMIN_TOUR_ROOMS[index]){ if(editor) editor.classList.add('hidden'); return; }
  ADMIN_HOTSPOT_ROOM_INDEX = index; ADMIN_SELECTED_POINT = null; editor.classList.remove('hidden');
  $('#hotspotRoomTitle').textContent = ADMIN_TOUR_ROOMS[index].room || `${t('detail.tourRoom')} ${index+1}`;
  $('#hotspotCoords').textContent = '—';
  renderHotspotControls();
  const viewerEl = $('#adminTourViewer');
  if(viewerEl){
    destroyAdminViewer(); viewerEl.innerHTML = '';
    if(window.pannellum){
      ADMIN_VIEWER = pannellum.viewer('adminTourViewer', {
        type:'equirectangular',
        panorama: ADMIN_TOUR_ROOMS[index].image,
        autoLoad:true,
        showControls:true,
        hfov:105,
        hotSpots:(ADMIN_TOUR_ROOMS[index].hotspots||[]).map(h=>({
          pitch:h.pitch,
          yaw:h.yaw,
          type:'info',
          cssClass:'room-hotspot',
          text:h.text,
          createTooltipFunc: roomHotspotTooltip,
          createTooltipArgs:{ text:h.text || 'Room' }
        }))
      });
      viewerEl.onclick = function(e){
        if(!ADMIN_VIEWER?.mouseEventToCoords) return;
        const coords = ADMIN_VIEWER.mouseEventToCoords(e);
        ADMIN_SELECTED_POINT = { pitch: Number(coords[0].toFixed(2)), yaw: Number(coords[1].toFixed(2)) };
        $('#hotspotCoords').textContent = `${ADMIN_SELECTED_POINT.pitch}, ${ADMIN_SELECTED_POINT.yaw}`;
      };
    }else{
      viewerEl.innerHTML = `<img src="${imageSrc(ADMIN_TOUR_ROOMS[index].image)}" alt="">`;
    }
  }
  renderTourBuilder();
  if(scroll) editor.scrollIntoView({behavior:'smooth', block:'start'});
}
function renderHotspotControls(){
  const target = $('#hotspotTargetRoom');
  if(target){
    target.innerHTML = ADMIN_TOUR_ROOMS.map((room,i)=>`<option value="${i}">${safeText(room.room || `${t('detail.tourRoom')} ${i+1}`)}</option>`).join('');
    target.value = String(Math.min(ADMIN_HOTSPOT_ROOM_INDEX + 1, Math.max(0, ADMIN_TOUR_ROOMS.length-1)));
  }
  const list = $('#hotspotList');
  const room = ADMIN_TOUR_ROOMS[ADMIN_HOTSPOT_ROOM_INDEX];
  if(list && room){
    list.innerHTML = (room.hotspots || []).length ? room.hotspots.map((h,i)=>`<div class="hotspot-row"><span>${safeText(h.text)} → ${safeText(ADMIN_TOUR_ROOMS[h.targetRoom]?.room || '')}<small>${h.pitch}, ${h.yaw}</small></span><button type="button" data-remove-hotspot="${i}">×</button></div>`).join('') : `<div class="empty small">${safeText(t('admin.noHotspots'))}</div>`;
    $$('[data-remove-hotspot]').forEach(btn=>btn.addEventListener('click',()=>{ room.hotspots.splice(Number(btn.dataset.removeHotspot),1); openHotspotEditor(ADMIN_HOTSPOT_ROOM_INDEX, false); }));
  }
}
function bindTourBuilder(){
  $('#addTourRoomBtn')?.addEventListener('click',()=>{ ADMIN_TOUR_ROOMS.push({room:`${t('detail.tourRoom')} ${ADMIN_TOUR_ROOMS.length+1}`, image:'https://pannellum.org/images/alma.jpg', hotspots:[]}); updateTourRoomsTextarea(); renderTourBuilder(); });
  $('#closeHotspotEditor')?.addEventListener('click',()=>{ $('#hotspotEditor')?.classList.add('hidden'); destroyAdminViewer(); });
  $('#addHotspotBtn')?.addEventListener('click',()=>{
    const room = ADMIN_TOUR_ROOMS[ADMIN_HOTSPOT_ROOM_INDEX];
    if(!room) return;
    if(!ADMIN_SELECTED_POINT){ showToast(t('admin.choosePoint')); return; }
    const targetRoom = Number($('#hotspotTargetRoom')?.value || 0);
    room.hotspots = room.hotspots || [];
    room.hotspots.push({ pitch: ADMIN_SELECTED_POINT.pitch, yaw: ADMIN_SELECTED_POINT.yaw, text: clean($('#hotspotLabel')?.value) || (ADMIN_TOUR_ROOMS[targetRoom]?.room || 'Go'), targetRoom });
    $('#hotspotLabel').value = ''; ADMIN_SELECTED_POINT = null; $('#hotspotCoords').textContent = '—'; openHotspotEditor(ADMIN_HOTSPOT_ROOM_INDEX, false);
  });
  $('#tourImages')?.addEventListener('change', e=>addTourFiles(e.target.files));
  $('[name="tourRooms"]')?.addEventListener('input',()=>{ syncTourNamesFromTextarea(); renderTourBuilder(); });
}
function setFormValue(form, name, value){ const el = form.elements[name]; if(!el) return; if(el.type === 'checkbox') el.checked = Boolean(value); else el.value = value ?? ''; }
async function startEditProperty(id){
  let p = allProperties().find(x=>x.id === id); const form = $('#propertyForm'); if(!p || !form) return;
  if(window.RostomDB?.enabled && window.RostomDB?.getProperty){
    try{ p = await window.RostomDB.getProperty(id) || p; }catch(err){ console.warn('Could not load full property for edit:', err); }
  }
  ADMIN_EDITING_ID = id;
  ADMIN_EXISTING_IMAGES = Array.from(new Set(extractImageList([p.images, p.image, p.mainImage, p.coverImage, p.photo, p.photos, p.gallery]).map(imageSrc).filter(Boolean)));
  ADMIN_TOUR_ROOMS = normalizeTourRooms(p).map(r=>({ ...r, hotspots: normalizeHotspots(r.hotspots) }));
  ADMIN_HOTSPOT_ROOM_INDEX = 0;
  ['title','category','status','wilaya','commune','address','price','currency','surface','landSurface','rooms','bedrooms','bathrooms','floor','yearBuilt','phone','description'].forEach(name=>setFormValue(form, name, p[name] || ''));
  setFormValue(form, 'features', (p.features || []).join('\n'));
  setFormValue(form, 'featured', p.featured);
  setFormValue(form, 'heroFeatured', p.heroFeatured);
  setFormValue(form, 'heroOrder', p.heroOrder || '');
  setFormValue(form, 'virtualTourUrl', p.virtualTourUrl || '');
  updateTourRoomsTextarea();
  fillCommuneControl($('#adminCommuneList'), form.elements.wilaya.value);
  renderImageManager(); renderTourBuilder(); openHotspotEditor(0, false);
  $('#publishTitle') && ($('#publishTitle').textContent = t('admin.editTitle'));
  const submit = form.querySelector('button[type="submit"]'); if(submit) submit.textContent = t('admin.update');
  $('#cancelEditBtn')?.classList.remove('hidden');
  location.hash = 'publish';
  form.scrollIntoView({behavior:'smooth', block:'start'});
}
function resetAdminForm(){
  const form = $('#propertyForm'); if(!form) return;
  form.reset(); form.elements.currency && (form.elements.currency.value = 'DZD');
  ADMIN_EDITING_ID = ''; ADMIN_EXISTING_IMAGES = []; ADMIN_TOUR_ROOMS = []; ADMIN_HOTSPOT_ROOM_INDEX = 0; ADMIN_SELECTED_POINT = null; destroyAdminViewer();
  renderImageManager(); renderTourBuilder(); $('#hotspotEditor')?.classList.add('hidden');
  $('#publishTitle') && ($('#publishTitle').textContent = t('admin.title'));
  const submit = form.querySelector('button[type="submit"]'); if(submit) submit.textContent = t('admin.submit');
  $('#cancelEditBtn')?.classList.add('hidden');
}
async function buildPropertyFromForm(form){
  const fd = new FormData(form);
  const newImages = await filesToUrls(Array.from($('#images')?.files || []).slice(0,12), 'photos');
  const finalTourRooms = [];
  syncTourNamesFromTextarea();
  for(const room of ADMIN_TOUR_ROOMS){
    const image = await roomImageToUrl(room);
    if(image) finalTourRooms.push({ room: clean(room.room) || `${t('detail.tourRoom')} ${finalTourRooms.length+1}`, image, hotspots: normalizeHotspots(room.hotspots) });
  }
  const virtualTourUrl = safeUrl(fd.get('virtualTourUrl'));
  return {
    id: ADMIN_EDITING_ID || `local-${Date.now()}`,
    title: clean(fd.get('title')) || 'Property',
    category: clean(fd.get('category')) || 'estates',
    status: clean(fd.get('status')) || 'sale',
    wilaya: clean(fd.get('wilaya')),
    commune: clean(fd.get('commune')),
    price: clean(fd.get('price')),
    currency: clean(fd.get('currency')) || 'DZD',
    surface: clean(fd.get('surface')),
    rooms: clean(fd.get('rooms')),
    bedrooms: clean(fd.get('bedrooms')),
    bathrooms: clean(fd.get('bathrooms')),
    floor: clean(fd.get('floor')),
    landSurface: clean(fd.get('landSurface')),
    yearBuilt: clean(fd.get('yearBuilt')),
    phone: clean(fd.get('phone')),
    address: clean(fd.get('address')),
    description: clean(fd.get('description')),
    features: clean(fd.get('features')).split(/,|\n/).map(clean).filter(Boolean),
    images: Array.from(new Set([...ADMIN_EXISTING_IMAGES, ...newImages].map(imageSrc).filter(Boolean))),
    featured: fd.get('featured') === 'on',
    heroFeatured: fd.get('heroFeatured') === 'on',
    heroOrder: clean(fd.get('heroOrder')) ? Math.min(8, Math.max(1, Number(fd.get('heroOrder')))) : '',
    hasVirtualTour: Boolean(virtualTourUrl || finalTourRooms.length),
    virtualTourType: finalTourRooms.length ? 'pannellum' : 'embed',
    virtualTourUrl,
    virtualTourRooms: finalTourRooms,
    createdAt: new Date().toISOString()
  };
}
async function saveLocalProperty(prop){
  const saved = savedProperties();
  const existing = saved.findIndex(p=>p.id === prop.id);
  if(existing >= 0) saved[existing] = prop;
  else { if(defaultProperties().some(p=>p.id === prop.id)) setHiddenDefaultIds([...hiddenDefaultIds(), prop.id]); saved.unshift(prop); }
  setSavedProperties(saved);
}
function initAdmin(){
  const loginScreen = $('#loginScreen'); const adminApp = $('#adminApp'); if(!loginScreen || !adminApp) return;
  ensureAdminHelpers(); bindTourBuilder(); renderImageManager(); renderTourBuilder();
  const unlock = () => { loginScreen.classList.add('hidden'); adminApp.classList.remove('hidden'); renderAdminList(); fillAdminStats(); initHeroSlider(); };
  if(sessionStorage.getItem(ADMIN_FLAG) === 'yes'){
    if(!window.RostomDB?.enabled || window.RostomDB?.isSignedIn?.()) unlock();
    else sessionStorage.removeItem(ADMIN_FLAG);
  }
  $('#loginForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const code = clean($('#adminCode')?.value);
    const email = clean($('#adminEmail')?.value);
    const password = clean($('#adminPassword')?.value);
    if(code !== ADMIN_CODE){ showToast(t('admin.badCode')); return; }
    if(window.RostomDB?.enabled && email && password){
      try{ await window.RostomDB.signIn(email, password); await loadDatabaseProperties(); DB_STATUS = 'connected'; }
      catch(err){ console.error(err); showToast(err.message || t('admin.supabaseLoginFailed')); return; }
    } else if(window.RostomDB?.enabled && (!email || !password)) {
      DB_STATUS = 'local';
      REMOTE_PROPERTIES = null;
    }
    sessionStorage.setItem(ADMIN_FLAG,'yes'); unlock();
  });
  $('#logoutBtn')?.addEventListener('click',async ()=>{ sessionStorage.removeItem(ADMIN_FLAG); await window.RostomDB?.signOut?.(); location.reload(); });
  $('#cancelEditBtn')?.addEventListener('click', resetAdminForm);
  const form = $('#propertyForm');
  form?.addEventListener('submit', async e=>{
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if(window.RostomDB?.enabled && !window.RostomDB?.isSignedIn?.()){
      showToast(t('admin.loginFirst'));
      return;
    }
    if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = t('admin.uploading'); }
    try{
      const wasEditing = Boolean(ADMIN_EDITING_ID);
      const editingId = ADMIN_EDITING_ID;
      const prop = await buildPropertyFromForm(form);
      if(window.RostomDB?.enabled){
        let remote;
        if(wasEditing) remote = await window.RostomDB.updateProperty(editingId, prop);
        else remote = await window.RostomDB.insertProperty(prop);
        const refreshed = await refreshAdminProperties();
        if(!refreshed){
          REMOTE_PROPERTIES = wasEditing ? (REMOTE_PROPERTIES || []).map(p=>p.id === editingId ? remote : p) : [remote, ...(REMOTE_PROPERTIES || [])];
          DB_STATUS = 'connected';
        }
        resetAdminForm(); showToast(wasEditing ? t('admin.updatedDb') : t('admin.savedDb')); renderAdminList(); fillAdminStats(); initHeroSlider(); return;
      }
      await saveLocalProperty(prop); resetAdminForm(); showToast(wasEditing ? t('admin.updated') : t('admin.saved')); renderAdminList(); fillAdminStats(); initHeroSlider();
    }catch(err){
      console.error(err); showToast(err.message || t('admin.uploadError'));
    }finally{
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalText || t('admin.submit'); }
    }
  });
  $('#exportBtn')?.addEventListener('click',()=>{ const blob = new Blob([JSON.stringify(savedProperties(),null,2)],{type:'application/json'}); const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='rostom-properties-export.json'; a.click(); URL.revokeObjectURL(a.href); });
  $('#importFile')?.addEventListener('change', async e=>{ const file = e.target.files[0]; if(!file) return; try{ const data = JSON.parse(await file.text()); if(Array.isArray(data)){ setSavedProperties(data); renderAdminList(); fillAdminStats(); initHeroSlider(); showToast(t('admin.importDone')); } } catch{ showToast(t('admin.invalidImport')); } });
}
async function deletePropertyById(id){
  if(window.RostomDB?.enabled && usingDatabase()){
    await window.RostomDB.deleteProperty(id);
    const refreshed = await refreshAdminProperties();
    if(!refreshed) REMOTE_PROPERTIES = (REMOTE_PROPERTIES || []).filter(p => p.id !== id);
    return;
  }
  const saved = savedProperties();
  if(saved.some(p => p.id === id)) setSavedProperties(saved.filter(p => p.id !== id));
  else setHiddenDefaultIds([...hiddenDefaultIds(), id]);
}
function renderAdminList(){
  const list = $('#adminList'); if(!list) return;
  const items = allProperties();
  list.innerHTML = items.length ? items.map(p=>`<div class="mini-prop">
    ${firstImage(p) ? `<img src="${firstImage(p)}" alt="">` : `<img alt="">`}
    <div><strong>${safeText(p.title || t('property.generic'))}</strong><small>${statusLabel(p.status)} · ${catLabel(p.category)} · ${safeText(wilayaDisplay(p.wilaya) || t('admin.noWilaya'))}</small>${p.heroFeatured ? `<small class="admin-tour-mini hero-mini">${safeText(t('admin.topSlider'))} ${safeText(p.heroOrder || '')}</small>` : ''}${hasVirtualTour(p) ? `<small class="admin-tour-mini">${safeText(t('card.tour'))}</small>` : ''}</div>
    <div class="mini-actions"><button class="btn-soft" data-edit="${safeText(p.id)}">${safeText(t('admin.edit'))}</button><button class="btn-soft btn-danger" data-delete="${safeText(p.id)}">${safeText(t('admin.delete'))}</button></div>
  </div>`).join('') : `<div class="empty">${safeText(t('admin.none'))}</div>`;
  $$('[data-edit]').forEach(btn=>btn.addEventListener('click',async ()=>{ btn.disabled = true; try{ await startEditProperty(btn.dataset.edit); } finally { btn.disabled = false; } }));
  $$('[data-delete]').forEach(btn=>btn.addEventListener('click',async ()=>{ const id = btn.dataset.delete; try{ await deletePropertyById(id); if(ADMIN_EDITING_ID === id) resetAdminForm(); renderAdminList(); fillAdminStats(); initHeroSlider(); renderCards($('#listingsGrid'), allProperties()); showToast(t('admin.deleted')); } catch(err){ console.error(err); showToast(t('admin.databaseDeleteBlocked')); } }));
}
function fillAdminStats(){ const items = allProperties(); const total = $('#adminTotal'); if(total) total.textContent = items.length; const sale = $('#adminSale'); if(sale) sale.textContent = items.filter(p=>p.status==='sale').length; const rent = $('#adminRent'); if(rent) rent.textContent = items.filter(p=>p.status==='rent').length; const db = $('#adminDbStatus'); if(db){ db.textContent = DB_STATUS === 'connected' ? 'Supabase connected' : DB_STATUS === 'offline' ? 'Supabase not ready / table missing' : 'Local browser mode'; } }


function normalizeCityText(value){
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function propertyCityHaystack(p){
  return [p?.wilaya, wilayaDisplay(p?.wilaya), p?.commune, p?.address]
    .map(normalizeCityText)
    .filter(Boolean)
    .join(' ');
}
function initHomeCities(){
  const track = $('#cityTrack');
  if(!track) return;
  if(!track.dataset.scrollBound){
    $$('[data-city-scroll]').forEach(btn => btn.addEventListener('click', () => {
      const direction = btn.dataset.cityScroll === 'next' ? 1 : -1;
      track.scrollBy({ left: direction * Math.max(240, track.clientWidth * .82), behavior: 'smooth' });
    }));
    track.dataset.scrollBound = 'yes';
  }
  const properties = allProperties();
  $$('.city-card[data-city-keys]', track).forEach(card => {
    const keys = clean(card.dataset.cityKeys).split('|').map(normalizeCityText).filter(Boolean);
    const count = properties.filter(p => {
      const hay = propertyCityHaystack(p);
      return keys.some(key => hay.includes(key));
    }).length;
    const countEl = $('[data-city-count]', card);
    if(countEl) countEl.textContent = String(count);
  });
}



function propertySortNewest(list){
  return uniqueProperties(list).sort((a,b)=>new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
}
function buildOverlayPropertyCard(p, extraClass = ''){
  const img = firstImage(p) || 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=74';
  const price = p.price ? `${formatPrice(p.price)} ${safeText(p.currency || 'DZD')}` : '';
  const roomsValue = p.bedrooms || p.rooms;
  const areaValue = p.surface || p.landSurface;
  const meta = [
    roomsValue && `${cardIcon('bed')}<span>${safeText(roomsValue)}</span>`,
    p.bathrooms && `${cardIcon('bath')}<span>${safeText(p.bathrooms)}</span>`,
    areaValue && `${cardIcon('area')}<span>${safeText(areaValue)} ${safeText(t('card.surface'))}</span>`
  ].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
  return `<a class="overlay-prop-card ${extraClass}" href="${propertyUrl(p.id)}" style="--bg:url('${cssUrl(img)}')">
    <span class="overlay-shade"></span>
    ${hasVirtualTour(p) ? `<span class="overlay-tour-pill">${safeText(t('card.tour'))}</span>` : ''}
    <span class="overlay-card-content">
      <strong>${safeText(p.title || t('property.generic'))}</strong>
      <small>${cardIcon('pin')}<span>${propertyLocation(p)}</span></small>
      ${price ? `<b>${price}</b>` : ''}
      ${meta ? `<em>${meta}</em>` : ''}
    </span>
  </a>`;
}
function initHomePropertyShowcases(){
  const latestBox = $('#latestPropertyShowcase');
  const handpickedBox = $('#handpickedPropertiesTrack');
  const items = propertySortNewest(allProperties()).filter(p => firstImage(p));
  if(latestBox){
    const latest = items.slice(0,4);
    latestBox.innerHTML = latest.length ? [
      latest[0] ? buildOverlayPropertyCard(latest[0], 'latest-large') : '',
      latest[1] ? buildOverlayPropertyCard(latest[1], 'latest-wide') : '',
      latest[2] ? buildOverlayPropertyCard(latest[2], 'latest-small') : '',
      `<a class="latest-view-all" href="${ROOT}pages/estates.html"><strong>${safeText(t('home.latest.view'))}</strong><span>${safeText(t('home.latest.viewSub'))}</span><i>→</i></a>`
    ].join('') : `<div class="empty light-empty">${safeText(t('empty'))}</div>`;
  }
  if(handpickedBox){
    const handpicked = propertySortNewest(allProperties()).filter(p => p.featured || firstImage(p)).slice(0,10);
    handpickedBox.innerHTML = handpicked.length ? handpicked.map(p => buildOverlayPropertyCard(p, 'handpicked-card')).join('') : `<div class="empty">${safeText(t('empty'))}</div>`;
    if(!handpickedBox.dataset.scrollBound){
      $$('[data-handpicked-scroll]').forEach(btn => btn.addEventListener('click', () => {
        const direction = btn.dataset.handpickedScroll === 'next' ? 1 : -1;
        handpickedBox.scrollBy({ left: direction * Math.max(260, handpickedBox.clientWidth * .82), behavior: 'smooth' });
      }));
      handpickedBox.dataset.scrollBound = 'yes';
    }
  }
}

function aiLang(){
  const lang = typeof currentLang === 'function' ? currentLang() : 'en';
  return ['en','fr','ar'].includes(lang) ? lang : 'en';
}
function hasArabic(text){ return /[\u0600-\u06FF]/.test(String(text || '')); }
function aiText(key){ return t(key); }
function aiNormalize(value){
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
}
function aiNumberWord(text){
  const q = aiNormalize(text);
  const map = [
    ['10','10'],['9','9'],['8','8'],['7','7'],['6','6'],['5','5'],['4','4'],['3','3'],['2','2'],['1','1'],
    ['عشر','10'],['تسع','9'],['ثمان','8'],['سبع','7'],['ست','6'],['خمس','5'],['اربع','4'],['أربع','4'],['ثلاث','3'],['اثنين','2'],['زوج','2'],['واحد','1'],
    ['dix','10'],['neuf','9'],['huit','8'],['sept','7'],['six','6'],['cinq','5'],['quatre','4'],['trois','3'],['deux','2'],['un','1'],
    ['ten','10'],['nine','9'],['eight','8'],['seven','7'],['six','6'],['five','5'],['four','4'],['three','3'],['two','2'],['one','1']
  ];
  const fMatch = q.match(/\bf\s*([1-9])\b/);
  if(fMatch) return Number(fMatch[1]);
  const roomMatch = q.match(/([1-9])\s*(rooms?|pieces?|chambres?|غرف|غرفه|بياس|pieces?)/);
  if(roomMatch) return Number(roomMatch[1]);
  for(const [word,num] of map){ if(q.includes(word)) return Number(num); }
  return 0;
}
function aiDetectIntent(query){
  const q = aiNormalize(query);
  const intent = { q, category:'', status:'', rooms:0, location:'', budget:0, wantsTour:false };
  if(/شقه|appartement|apartment|apart|\bf[1-9]\b/.test(q)) intent.category = 'apartments';
  else if(/فيلا|villa/.test(q)) intent.category = 'villas';
  else if(/منزل|دار|بيت|maison|house/.test(q)) intent.category = 'houses';
  else if(/ارض|قطعه|terrain|land/.test(q)) intent.category = 'land';
  else if(/مكتب|bureau|office/.test(q)) intent.category = 'offices';
  if(/كراء|ايجار|rent|location|louer/.test(q)) intent.status = 'rent';
  else if(/شراء|بيع|للبيع|sale|buy|acheter|vente/.test(q)) intent.status = 'sale';
  intent.rooms = aiNumberWord(query);
  intent.wantsTour = /360|جوله|visite|tour/.test(q);
  const budgetMatch = q.match(/(\d+(?:[\.,]\d+)?)\s*(milliard|md|مليار|million|millions|مليون|ملايين)/);
  if(budgetMatch){
    const n = Number(budgetMatch[1].replace(',','.'));
    const unit = budgetMatch[2];
    intent.budget = /milliard|md|مليار/.test(unit) ? n * 10000000 : n * 1000000;
  } else {
    const raw = q.match(/(\d{6,})/);
    if(raw) intent.budget = Number(raw[1]);
  }
  const hayLocations = [];
  (LOCATION_DATA.wilayas || []).forEach(w => hayLocations.push({ key: aiNormalize(`${w.code} ${w.name} ${w.name_fr || ''} ${w.name_ar || ''}`), value: wilayaValue(w) }));
  allProperties().forEach(p => [p.wilaya, wilayaDisplay(p.wilaya), p.commune, p.address].forEach(v => { if(clean(v)) hayLocations.push({ key: aiNormalize(v), value: clean(v) }); }));
  const found = hayLocations.find(item => item.key && item.key.split(/\s+/).some(part => part.length > 2 && q.includes(part)));
  if(found) intent.location = found.value;
  return intent;
}
function aiScoreProperty(p, intent){
  let score = 0;
  const hay = aiNormalize([p.title,p.description,p.category,p.status,p.wilaya,wilayaDisplay(p.wilaya),p.commune,p.address,catLabel(p.category),statusTypeLabel(p)].join(' '));
  if(intent.category && p.category === intent.category) score += 7;
  if(intent.status && p.status === intent.status) score += 5;
  if(intent.location && hay.includes(aiNormalize(intent.location).split(' - ').pop())) score += 5;
  if(intent.rooms){
    const values = [p.rooms,p.bedrooms].map(v => Number(String(v || '').replace(/\D/g,''))).filter(Boolean);
    if(values.includes(intent.rooms)) score += 4;
    else if(values.some(v => Math.abs(v - intent.rooms) === 1)) score += 1.4;
  }
  if(intent.wantsTour && hasVirtualTour(p)) score += 2;
  const price = Number(String(p.price || '').replace(/\s/g,''));
  if(intent.budget && !Number.isNaN(price) && price <= intent.budget) score += 2;
  aiNormalize(intent.q).split(/\s+/).filter(w => w.length > 3).slice(0,8).forEach(w => { if(hay.includes(w)) score += .35; });
  return score;
}
function aiFindMatches(query){
  const intent = aiDetectIntent(query);
  const items = allProperties().map(p => ({ p, score: aiScoreProperty(p,intent) }))
    .filter(x => x.score > .75)
    .sort((a,b) => b.score - a.score || new Date(b.p.createdAt || 0) - new Date(a.p.createdAt || 0))
    .slice(0,4)
    .map(x => x.p);
  return { intent, items };
}
function aiMiniResultCard(p){
  const img = firstImage(p);
  const price = p.price ? `${formatPrice(p.price)} ${safeText(p.currency || 'DZD')}` : '';
  return `<a class="ai-result-card" href="${propertyUrl(p.id)}">
    ${img ? `<img src="${img}" alt="${safeText(p.title || t('property.generic'))}" loading="lazy">` : '<span class="ai-result-noimg"></span>'}
    <span><strong>${safeText(p.title || t('property.generic'))}</strong><small>${propertyLocation(p)}</small>${price ? `<b>${price}</b>` : ''}</span>
  </a>`;
}
const AI_PROVIDER_NAME = 'Puter.js';
const AI_MODEL = 'gpt-5-nano';
const AI_CDN = 'https://js.puter.com/v2/';
let AI_SCRIPT_PROMISE = null;
function aiLoadProvider(){
  if(window.puter?.ai?.chat) return Promise.resolve(window.puter);
  if(AI_SCRIPT_PROMISE) return AI_SCRIPT_PROMISE;
  AI_SCRIPT_PROMISE = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-rostom-ai-provider="puter"]');
    if(existing){
      existing.addEventListener('load', () => resolve(window.puter), { once:true });
      existing.addEventListener('error', () => reject(new Error('AI provider failed to load')), { once:true });
      return;
    }
    const script = document.createElement('script');
    script.src = AI_CDN;
    script.async = true;
    script.defer = true;
    script.dataset.rostomAiProvider = 'puter';
    script.onload = () => window.puter?.ai?.chat ? resolve(window.puter) : reject(new Error('AI provider unavailable'));
    script.onerror = () => reject(new Error('AI provider failed to load'));
    document.head.appendChild(script);
  });
  return AI_SCRIPT_PROMISE;
}
function aiFormatListingForPrompt(p, index){
  const price = p.price ? `${formatPrice(p.price)} ${p.currency || 'DZD'}` : 'price not listed';
  const bits = [
    `${index + 1}. ${p.title || t('property.generic')}`,
    `type: ${catLabel(p.category) || p.category || 'property'}`,
    `status: ${statusTypeLabel(p) || p.status || 'available'}`,
    `location: ${propertyLocation(p) || 'Algeria'}`,
    `rooms: ${p.rooms || p.bedrooms || 'not listed'}`,
    `surface: ${p.surface || p.landSurface || 'not listed'}`,
    `price: ${price}`,
    `virtual tour: ${hasVirtualTour(p) ? 'yes' : 'no'}`,
    `link: ${propertyUrl(p.id)}`
  ];
  return bits.join(' | ');
}
function aiBuildPrompt(query, items){
  const langName = aiLang() === 'ar' || hasArabic(query) ? 'Arabic' : (aiLang() === 'fr' ? 'French' : 'English');
  const listings = items.length ? items.map(aiFormatListingForPrompt).join('\n') : 'No strong matching listings were found by the website matcher.';
  return `You are Rostom AI, the website assistant for Rostom Immobilier in Algeria.
Reply in ${langName}, or in the same language/dialect used by the visitor.
Be helpful, short, warm, and practical. Use Algerian real-estate context when useful.
The visitor can ask about buying, renting, property choice, budget, neighborhoods, paperwork basics, or the listings.
For property recommendations, use ONLY the website listings provided below. Do not invent properties, prices, phone numbers, or availability. If the listings are not enough, ask for city, budget, property type, rooms, and whether they want buying or renting.
When matching listings exist, mention the best 1-3 options and why they fit. End with a simple next step: open the listing card or contact Rostom Immobilier.

Visitor message: ${query}

Website listing matches:
${listings}`;
}
function aiExtractProviderText(response){
  if(typeof response === 'string') return response;
  if(response?.text) return response.text;
  if(response?.content && typeof response.content === 'string') return response.content;
  const content = response?.message?.content;
  if(typeof content === 'string') return content;
  if(Array.isArray(content)) return content.map(part => part?.text || part?.content || '').join(' ').trim();
  return '';
}
async function aiAskProvider(query, items){
  const puter = await aiLoadProvider();
  const response = await puter.ai.chat(aiBuildPrompt(query, items), {
    model: AI_MODEL,
    temperature: 0.35,
    max_tokens: 360
  });
  const text = clean(aiExtractProviderText(response));
  if(!text) throw new Error('Empty AI response');
  return text;
}
function aiFallbackReply(items){
  if(items.length){
    return `${safeText(aiText('ai.results'))}<div class="ai-results">${items.map(aiMiniResultCard).join('')}</div>`;
  }
  return `${safeText(aiText('ai.noResults'))}<br><small>${safeText(aiText('ai.onlySite'))}</small>`;
}

function initPropertyAI(){
  if($('#aiPropertyAssistant') || isAdminScreen()) return;
  const wrap = document.createElement('div');
  wrap.className = 'ai-assistant';
  wrap.id = 'aiPropertyAssistant';
  wrap.innerHTML = `<button class="ai-float" id="aiFloatBtn" type="button" aria-label="${safeText(aiText('ai.nudge'))}"><span>${safeText(aiText('ai.button') || 'AI')}</span></button>
    <div class="ai-nudge" id="aiNudge">${safeText(aiText('ai.nudge'))}</div>
    <section class="ai-panel" id="aiPanel" aria-label="${safeText(aiText('ai.title'))}">
      <div class="ai-panel-head"><div><strong>${safeText(aiText('ai.title'))}</strong><small>${safeText(aiText('ai.subtitle'))}</small></div><button type="button" id="aiCloseBtn" aria-label="${safeText(aiText('ai.close'))}">×</button></div>
      <div class="ai-messages" id="aiMessages"><div class="ai-msg ai-bot">${safeText(aiText('ai.welcome'))}<br><small>${safeText(aiText('ai.onlySite'))}</small></div></div>
      <div class="ai-quick"><button type="button" data-ai-sample="${safeText(aiText('ai.sample.apartmentQuery'))}">${safeText(aiText('ai.sample.apartment'))}</button><button type="button" data-ai-sample="${safeText(aiText('ai.sample.villaQuery'))}">${safeText(aiText('ai.sample.villa'))}</button><button type="button" data-ai-sample="${safeText(aiText('ai.sample.rentQuery'))}">${safeText(aiText('ai.sample.rent'))}</button></div>
      <form class="ai-form" id="aiForm"><input id="aiInput" autocomplete="off" placeholder="${safeText(aiText('ai.placeholder'))}"><button type="submit">${safeText(aiText('ai.send'))}</button></form>
    </section>`;
  document.body.appendChild(wrap);
  const panel = $('#aiPanel'), input = $('#aiInput'), messages = $('#aiMessages');
  const open = () => { wrap.classList.add('open'); setTimeout(()=>input?.focus(),80); };
  const close = () => wrap.classList.remove('open');
  $('#aiFloatBtn')?.addEventListener('click', () => wrap.classList.contains('open') ? close() : open());
  $('#aiNudge')?.addEventListener('click', open);
  $('#aiCloseBtn')?.addEventListener('click', close);
  function addMessage(html, who='bot'){
    const div = document.createElement('div');
    div.className = `ai-msg ai-${who}`;
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }
  async function answer(query){
    addMessage(safeText(query), 'user');
    const { items } = aiFindMatches(query);
    const thinking = addMessage(`<span class="ai-thinking">${safeText(aiText('ai.thinking'))}</span>`, 'bot');
    try{
      const text = await aiAskProvider(query, items);
      thinking.innerHTML = `${safeText(text).replace(/\n/g,'<br>')}${items.length ? `<div class="ai-results">${items.map(aiMiniResultCard).join('')}</div>` : `<br><small>${safeText(aiText('ai.onlySite'))}</small>`}`;
    } catch(err){
      console.warn('AI provider unavailable; using local fallback.', err);
      thinking.innerHTML = aiFallbackReply(items);
    }
    messages.scrollTop = messages.scrollHeight;
  }
  $('#aiForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const value = clean(input?.value);
    if(!value) return;
    input.value = '';
    answer(value);
  });
  $$('[data-ai-sample]', wrap).forEach(btn => btn.addEventListener('click', () => { open(); answer(btn.dataset.aiSample); }));
}

async function init(){
  showPageLoader();

  applyLanguage(); bindLanguageSelectors();
  LOCATION_DATA = fallbackLocationData();
  fillWilayaSelects(); applyUrlFilters(); bindLocationControls();
  initNav(); initReveal(); initSearchBox(); initContactForm();

  try{
    const [, locationsResult] = await Promise.allSettled([loadDatabaseProperties(), loadLocationData()]);
    if(locationsResult.status === 'fulfilled') LOCATION_DATA = locationsResult.value;
    fillWilayaSelects(); applyUrlFilters(); bindLocationControls();

    // Render data-dependent UI only after Supabase/local data has settled.
    // This prevents the homepage hero from first showing a partial/fallback set
    // and then jumping to the full 8 slides a moment later.
    initHeroSlider();
    initListings();
    initHomeCities();
    initHomePropertyShowcases();
    initPropertyAI();
    initPropertyDetail();
    initAdmin();
    if($('#adminList')){ renderAdminList(); fillAdminStats(); }
  } finally {
    hidePageLoader();
  }
}
document.addEventListener('DOMContentLoaded', init);
