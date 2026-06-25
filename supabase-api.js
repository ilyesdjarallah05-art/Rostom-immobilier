/* Rostom Immobilier — tiny Supabase REST + Storage helper
   Static HTML/CSS/JS only. No npm, no build step. */
(function(){
  const cfg = window.ROSTOM_SUPABASE || {};
  const clean = v => String(v || '').trim();
  const baseUrl = clean(cfg.url).replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
  const anonKey = clean(cfg.anonKey || cfg.publishableKey);
  const bucket = clean(cfg.storageBucket || 'property-media');
  const enabled = Boolean(baseUrl && anonKey && !baseUrl.includes('PASTE_') && !anonKey.includes('PASTE_'));

  function keyLooksWrong(){
    if(!anonKey) return 'Missing Supabase public key.';
    if(anonKey.split('.').length !== 3 && !anonKey.startsWith('sb_publishable_')) return 'Supabase key looks incomplete. Copy the full anon/public key.';
    return '';
  }

  function restUrl(path){ return `${baseUrl}/rest/v1/${path}`; }
  function authUrl(path){ return `${baseUrl}/auth/v1/${path}`; }
  function storageUrl(path){ return `${baseUrl}/storage/v1/${path}`; }
  function encodePath(path){ return String(path).split('/').map(encodeURIComponent).join('/'); }
  function publicStorageUrl(path){ return storageUrl(`object/public/${encodeURIComponent(bucket)}/${encodePath(path)}`); }

  const SESSION_KEY = 'rostomSupabaseSessionV1';
  function getSession(){ try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; } }
  function setSession(session){ sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }
  function authToken(){ return getSession()?.access_token || anonKey; }
  function headers(extra={}){
    return { apikey: anonKey, Authorization: `Bearer ${authToken()}`, 'Content-Type': 'application/json', ...extra };
  }
  function normalizeHotspots(value){
    if(!Array.isArray(value)) return [];
    return value.map(h => {
      const pitch = Number(h.pitch), yaw = Number(h.yaw), targetRoom = Number(h.targetRoom);
      return { pitch, yaw, text: clean(h.text) || 'Go', targetRoom: Number.isFinite(targetRoom) ? targetRoom : 0 };
    }).filter(h => Number.isFinite(h.pitch) && Number.isFinite(h.yaw));
  }
  function normalizeRooms(value){
    if(Array.isArray(value)) return value.filter(Boolean).map((r,i)=>({
      room: clean(r.room) || `Room ${i+1}`,
      image: clean(r.image),
      hotspots: normalizeHotspots(r.hotspots)
    })).filter(r=>r.image);
    return [];
  }
  function toCamel(row){
    const rooms = normalizeRooms(row.virtual_tour_rooms);
    return {
      id: row.id,
      title: row.title || 'Property',
      category: row.category || 'estates',
      status: row.status || 'sale',
      wilaya: row.wilaya || '',
      commune: row.commune || '',
      address: row.address || '',
      price: row.price ?? '',
      currency: row.currency || 'DZD',
      surface: row.surface ?? '',
      landSurface: row.land_surface ?? '',
      rooms: row.rooms || '',
      bedrooms: row.bedrooms || '',
      bathrooms: row.bathrooms || '',
      floor: row.floor || '',
      yearBuilt: row.year_built || '',
      phone: row.phone || '',
      description: row.description || '',
      features: Array.isArray(row.features) ? row.features : [],
      images: Array.isArray(row.images) ? row.images : [],
      featured: Boolean(row.featured),
      isPublished: row.is_published !== false,
      hasVirtualTour: Boolean(row.has_virtual_tour || row.virtual_tour_url || rooms.length),
      virtualTourType: row.virtual_tour_type || (rooms.length ? 'pannellum' : 'embed'),
      virtualTourUrl: row.virtual_tour_url || '',
      virtualTourRooms: rooms,
      createdAt: row.created_at || new Date().toISOString(),
      _source: 'supabase'
    };
  }
  function numberOrNull(v){ return clean(v) === '' ? null : Number(v); }
  function toDb(prop){
    const tourRooms = normalizeRooms(prop.virtualTourRooms);
    const tourUrl = clean(prop.virtualTourUrl);
    return {
      title: prop.title || null,
      category: prop.category || null,
      status: prop.status || null,
      wilaya: prop.wilaya || null,
      commune: prop.commune || null,
      address: prop.address || null,
      price: numberOrNull(prop.price),
      currency: prop.currency || 'DZD',
      surface: numberOrNull(prop.surface),
      land_surface: numberOrNull(prop.landSurface),
      rooms: prop.rooms || null,
      bedrooms: prop.bedrooms || null,
      bathrooms: prop.bathrooms || null,
      floor: prop.floor || null,
      year_built: prop.yearBuilt || null,
      phone: prop.phone || null,
      description: prop.description || null,
      features: prop.features || [],
      images: prop.images || [],
      featured: Boolean(prop.featured),
      is_published: true,
      has_virtual_tour: Boolean(tourUrl || tourRooms.length || prop.hasVirtualTour),
      virtual_tour_type: prop.virtualTourType || (tourRooms.length ? 'pannellum' : 'embed'),
      virtual_tour_url: tourUrl || null,
      virtual_tour_rooms: tourRooms
    };
  }

  async function signIn(email, password){
    if(!enabled) throw new Error('Supabase is not configured.');
    const keyProblem = keyLooksWrong(); if(keyProblem) throw new Error(keyProblem);
    const res = await fetch(authUrl('token?grant_type=password'), {
      method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(()=>null);
    if(!res.ok) throw new Error(data?.msg || data?.message || 'Admin login failed.');
    setSession(data); return data;
  }
  async function signOut(){
    const token = getSession()?.access_token;
    if(enabled && token){ try { await fetch(authUrl('logout'), { method:'POST', headers:{ apikey: anonKey, Authorization:`Bearer ${token}` } }); } catch {} }
    clearSession();
  }
  function isSignedIn(){ return Boolean(getSession()?.access_token); }

  async function request(path, options={}){
    if(!enabled) throw new Error('Supabase is not configured.');
    const keyProblem = keyLooksWrong(); if(keyProblem) throw new Error(keyProblem);
    const res = await fetch(restUrl(path), { ...options, headers: headers(options.headers || {}) });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if(!res.ok){
      let msg = data?.message || data?.hint || data?.details || `Supabase error ${res.status}`;
      if(res.status === 401 && /invalid api key/i.test(msg)) msg = 'Invalid Supabase API key. Check supabase-config.js: use Project Settings > API Keys > anon public / publishable key, not service_role and not a shortened key.';
      throw new Error(msg);
    }
    return data;
  }
  const SUMMARY_SELECT = [
    'id','title','category','status','wilaya','commune','address','price','currency',
    'surface','land_surface','rooms','bedrooms','bathrooms','floor','year_built','phone',
    'description','features','images','featured','is_published','has_virtual_tour',
    'virtual_tour_type','virtual_tour_url','created_at'
  ].join(',');

  async function listProperties(){
    const rows = await request(`properties?select=${SUMMARY_SELECT}&is_published=eq.true&order=created_at.desc&limit=60`);
    return (rows || []).map(toCamel);
  }
  async function getProperty(id){
    if(!id) return null;
    const rows = await request(`properties?select=*&id=eq.${encodeURIComponent(id)}&is_published=eq.true&limit=1`);
    return rows?.[0] ? toCamel(rows[0]) : null;
  }
  async function insertProperty(prop){
    const rows = await request('properties', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDb(prop)) });
    return rows?.[0] ? toCamel(rows[0]) : prop;
  }
  async function updateProperty(id, prop){
    const rows = await request(`properties?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDb(prop)) });
    return rows?.[0] ? toCamel(rows[0]) : { ...prop, id };
  }
  async function deleteProperty(id){
    await request(`properties?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return true;
  }

  function safeFileName(name){
    const raw = clean(name).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
    return raw || `file-${Date.now()}.jpg`;
  }
  async function uploadFile(file, folder='photos'){
    if(!enabled) throw new Error('Supabase is not configured.');
    if(!isSignedIn()) throw new Error('Admin login required before uploading files.');
    const path = `${folder}/${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeFileName(file.name)}`;
    const keyProblem = keyLooksWrong(); if(keyProblem) throw new Error(keyProblem);
    let res;
    try{
      res = await fetch(storageUrl(`object/${encodeURIComponent(bucket)}/${encodePath(path)}`), {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${authToken()}`, 'Content-Type': file.type || 'application/octet-stream', 'Cache-Control': '3600' },
        body: file
      });
    }catch(err){
      throw new Error('File upload failed before Supabase replied. Try a smaller image, hard refresh the page, and disable browser extensions if the console mentions requests.js.');
    }
    const data = await res.json().catch(()=>null);
    if(!res.ok) throw new Error(data?.message || data?.error || `Storage upload failed ${res.status}`);
    return { path, publicUrl: publicStorageUrl(path), data };
  }
  async function uploadFiles(files, folder='photos'){
    const list = Array.from(files || []);
    const out = [];
    for(const file of list){ out.push(await uploadFile(file, folder)); }
    return out;
  }

  window.RostomDB = { enabled, baseUrl, bucket, keyLooksWrong, listProperties, getProperty, insertProperty, updateProperty, deleteProperty, signIn, signOut, isSignedIn, uploadFile, uploadFiles, publicStorageUrl };
})();
