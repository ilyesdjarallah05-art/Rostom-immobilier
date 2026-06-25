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
  function asMediaUrl(value){
    const raw = clean(value);
    if(!raw) return '';
    if(/^(https?:\/\/|data:image\/|blob:)/i.test(raw)) return raw;
    const path = raw.replace(/^\/+/, '').replace(/^property-media\//, '');
    return publicStorageUrl(path);
  }
  function normalizeMediaList(value){
    if(!value) return [];
    if(Array.isArray(value)) return value.flatMap(normalizeMediaList).filter(Boolean);
    if(typeof value === 'object') return normalizeMediaList(value.publicUrl || value.url || value.src || value.path || value.image || value.photo || value.href);
    const raw = clean(value);
    if(!raw) return [];
    if(raw.startsWith('[') || raw.startsWith('{')){
      try { return normalizeMediaList(JSON.parse(raw)); } catch {}
    }
    return raw.split(/\s*,\s*/).map(asMediaUrl).filter(Boolean);
  }
  function normalizeTextList(value){
    if(!value) return [];
    if(Array.isArray(value)) return value.map(clean).filter(Boolean);
    const raw = clean(value);
    if(!raw) return [];
    if(raw.startsWith('[')){ try { return normalizeTextList(JSON.parse(raw)); } catch {} }
    return raw.split(/\n|,/).map(clean).filter(Boolean);
  }

  const SESSION_KEY = 'rostomSupabaseSessionV1';
  function getSession(){ try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; } }
  function sessionExpiresAt(session){ return Number(session?.expires_at || 0); }
  function sessionIsExpired(session, skewSeconds=60){
    const exp = sessionExpiresAt(session);
    return Boolean(exp && exp <= Math.floor(Date.now() / 1000) + skewSeconds);
  }
  function setSession(session){
    if(!session) return clearSession();
    const previous = getSession() || {};
    const next = { ...previous, ...session };
    if(session.expires_in && !session.expires_at){
      next.expires_at = Math.floor(Date.now() / 1000) + Number(session.expires_in);
    }
    if(!next.refresh_token && previous.refresh_token) next.refresh_token = previous.refresh_token;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }
  function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }
  async function refreshSession(){
    const current = getSession();
    if(!current?.refresh_token){ clearSession(); return false; }
    try{
      const res = await fetch(authUrl('token?grant_type=refresh_token'), {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.refresh_token })
      });
      const data = await res.json().catch(()=>null);
      if(!res.ok || !data?.access_token){ clearSession(); return false; }
      setSession({ ...data, refresh_token: data.refresh_token || current.refresh_token });
      return true;
    }catch(err){
      console.warn('Supabase session refresh failed:', err);
      return false;
    }
  }
  async function authToken(options={}){
    let session = getSession();
    if(session?.access_token && sessionIsExpired(session)){
      await refreshSession();
      session = getSession();
    }
    if(options.requireAuth && !session?.access_token) throw new Error('Admin login required. Please sign in again.');
    return session?.access_token || anonKey;
  }
  async function headers(extra={}, options={}){
    const token = await authToken(options);
    return { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
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
      image: asMediaUrl(r.image),
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
      features: normalizeTextList(row.features),
      images: normalizeMediaList([row.images, row.image, row.main_image, row.cover_image, row.photo, row.photos, row.gallery]),
      featured: Boolean(row.featured),
      heroFeatured: Boolean(row.hero_featured),
      heroOrder: row.hero_order ?? '',
      isPublished: row.is_published !== false,
      hasVirtualTour: Boolean(row.virtual_tour_url || rooms.length),
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
      features: normalizeTextList(prop.features),
      images: normalizeMediaList(prop.images),
      featured: Boolean(prop.featured),
      hero_featured: Boolean(prop.heroFeatured),
      hero_order: prop.heroOrder ? Number(prop.heroOrder) : null,
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
  function isSignedIn(){
    const session = getSession();
    return Boolean(session?.access_token && (!sessionIsExpired(session) || session.refresh_token));
  }

  async function readResponse(res){
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { text, data };
  }
  async function request(path, options={}){
    if(!enabled) throw new Error('Supabase is not configured.');
    const keyProblem = keyLooksWrong(); if(keyProblem) throw new Error(keyProblem);
    const requireAuth = Boolean(options.requireAuth);
    const method = String(options.method || 'GET').toUpperCase();
    const doFetch = async () => fetch(restUrl(path), { ...options, headers: await headers(options.headers || {}, { requireAuth }) });
    let res = await doFetch();
    let parsed = await readResponse(res);

    // An old admin tab can keep an expired JWT in sessionStorage. Retry once with
    // a refreshed token; for public GET requests, retry with the anon key after
    // clearing a bad session so listings do not disappear.
    if(res.status === 401){
      const hadRefresh = Boolean(getSession()?.refresh_token);
      const refreshed = hadRefresh ? await refreshSession() : false;
      if(refreshed){
        res = await doFetch();
        parsed = await readResponse(res);
      }else if(!requireAuth && method === 'GET'){
        clearSession();
        res = await doFetch();
        parsed = await readResponse(res);
      }
    }

    if(!res.ok){
      const data = parsed.data;
      let msg = data?.message || data?.hint || data?.details || `Supabase error ${res.status}`;
      if(res.status === 401 && /invalid api key/i.test(msg)) msg = 'Invalid Supabase API key. Check supabase-config.js: use Project Settings > API Keys > anon public / publishable key, not service_role and not a shortened key.';
      if(res.status === 401 && /jwt|token|expired/i.test(msg)) msg = 'Admin session expired. Please sign in again.';
      throw new Error(msg);
    }
    return parsed.data;
  }
  const SUMMARY_SELECT = [
    'id','title','category','status','wilaya','commune','address','price','currency',
    'surface','land_surface','rooms','bedrooms','bathrooms','floor','year_built','phone',
    'description','features','images','featured','hero_featured','hero_order','is_published','has_virtual_tour',
    'virtual_tour_type','virtual_tour_url','created_at'
  ].join(',');

  async function listProperties(options={}){
    const limit = Math.min(1000, Math.max(1, Number(options.limit || 1000)));
    const publishedFilter = options.published === false ? '' : '&or=(is_published.eq.true,is_published.is.null)';
    const rows = await request(`properties?select=${SUMMARY_SELECT}${publishedFilter}&order=created_at.desc&limit=${limit}`);
    return (rows || []).map(toCamel);
  }
  async function listAdminProperties(){
    try{
      const rows = await request(`properties?select=${SUMMARY_SELECT}&order=created_at.desc&limit=1000`);
      return (rows || []).map(toCamel);
    }catch(err){
      console.warn('Admin full property list failed, falling back to public list:', err);
      return listProperties({ limit: 1000 });
    }
  }
  async function getProperty(id){
    if(!id) return null;
    const rows = await request(`properties?select=*&id=eq.${encodeURIComponent(id)}&is_published=eq.true&limit=1`);
    return rows?.[0] ? toCamel(rows[0]) : null;
  }
  async function insertProperty(prop){
    const rows = await request('properties', { requireAuth: true, method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDb(prop)) });
    return rows?.[0] ? toCamel(rows[0]) : prop;
  }
  async function updateProperty(id, prop){
    const rows = await request(`properties?id=eq.${encodeURIComponent(id)}`, { requireAuth: true, method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDb(prop)) });
    return rows?.[0] ? toCamel(rows[0]) : { ...prop, id };
  }
  async function deleteProperty(id){
    await request(`properties?id=eq.${encodeURIComponent(id)}`, { requireAuth: true, method: 'DELETE', headers: { Prefer: 'return=minimal' } });
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
        headers: { ...(await headers({}, { requireAuth: true })), 'Content-Type': file.type || 'application/octet-stream', 'Cache-Control': '3600' },
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

  window.RostomDB = { enabled, baseUrl, bucket, keyLooksWrong, listProperties, listAdminProperties, getProperty, insertProperty, updateProperty, deleteProperty, signIn, signOut, isSignedIn, refreshSession, uploadFile, uploadFiles, publicStorageUrl };
})();
