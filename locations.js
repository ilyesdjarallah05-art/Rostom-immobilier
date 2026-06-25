/* Rostom Immobilier — Algeria locations
   - Always shows the 69 wilayas locally.
   - When internet is available, it also tries to load communes from GeoAlgeria.
   - If online data is old/58 wilayas only, local 69 wilayas are still kept.
*/

const ROSTOM_LOCATION_CACHE_KEY = 'rostomLocationDataV3_69Wilayas';
const ROSTOM_REMOTE_COMMUNES_URL = 'https://cdn.jsdelivr.net/npm/geoalgeria/data/ecommerce/communes.json';

const ROSTOM_WILAYAS_FALLBACK = [
  {code:'01', fr:'Adrar', ar:'أدرار'}, {code:'02', fr:'Chlef', ar:'الشلف'}, {code:'03', fr:'Laghouat', ar:'الأغواط'}, {code:'04', fr:'Oum El Bouaghi', ar:'أم البواقي'},
  {code:'05', fr:'Batna', ar:'باتنة'}, {code:'06', fr:'Béjaïa', ar:'بجاية'}, {code:'07', fr:'Biskra', ar:'بسكرة'}, {code:'08', fr:'Béchar', ar:'بشار'},
  {code:'09', fr:'Blida', ar:'البليدة'}, {code:'10', fr:'Bouira', ar:'البويرة'}, {code:'11', fr:'Tamanrasset', ar:'تمنراست'}, {code:'12', fr:'Tébessa', ar:'تبسة'},
  {code:'13', fr:'Tlemcen', ar:'تلمسان'}, {code:'14', fr:'Tiaret', ar:'تيارت'}, {code:'15', fr:'Tizi Ouzou', ar:'تيزي وزو'}, {code:'16', fr:'Alger', ar:'الجزائر'},
  {code:'17', fr:'Djelfa', ar:'الجلفة'}, {code:'18', fr:'Jijel', ar:'جيجل'}, {code:'19', fr:'Sétif', ar:'سطيف'}, {code:'20', fr:'Saïda', ar:'سعيدة'},
  {code:'21', fr:'Skikda', ar:'سكيكدة'}, {code:'22', fr:'Sidi Bel Abbès', ar:'سيدي بلعباس'}, {code:'23', fr:'Annaba', ar:'عنابة'}, {code:'24', fr:'Guelma', ar:'قالمة'},
  {code:'25', fr:'Constantine', ar:'قسنطينة'}, {code:'26', fr:'Médéa', ar:'المدية'}, {code:'27', fr:'Mostaganem', ar:'مستغانم'}, {code:'28', fr:"M'Sila", ar:'المسيلة'},
  {code:'29', fr:'Mascara', ar:'معسكر'}, {code:'30', fr:'Ouargla', ar:'ورقلة'}, {code:'31', fr:'Oran', ar:'وهران'}, {code:'32', fr:'El Bayadh', ar:'البيض'},
  {code:'33', fr:'Illizi', ar:'إليزي'}, {code:'34', fr:'Bordj Bou Arréridj', ar:'برج بوعريريج'}, {code:'35', fr:'Boumerdès', ar:'بومرداس'}, {code:'36', fr:'El Tarf', ar:'الطارف'},
  {code:'37', fr:'Tindouf', ar:'تندوف'}, {code:'38', fr:'Tissemsilt', ar:'تيسمسيلت'}, {code:'39', fr:'El Oued', ar:'الوادي'}, {code:'40', fr:'Khenchela', ar:'خنشلة'},
  {code:'41', fr:'Souk Ahras', ar:'سوق أهراس'}, {code:'42', fr:'Tipaza', ar:'تيبازة'}, {code:'43', fr:'Mila', ar:'ميلة'}, {code:'44', fr:'Aïn Defla', ar:'عين الدفلى'},
  {code:'45', fr:'Naâma', ar:'النعامة'}, {code:'46', fr:'Aïn Témouchent', ar:'عين تموشنت'}, {code:'47', fr:'Ghardaïa', ar:'غرداية'}, {code:'48', fr:'Relizane', ar:'غليزان'},
  {code:'49', fr:'Timimoun', ar:'تيميمون'}, {code:'50', fr:'Bordj Badji Mokhtar', ar:'برج باجي مختار'}, {code:'51', fr:'Ouled Djellal', ar:'أولاد جلال'}, {code:'52', fr:'Béni Abbès', ar:'بني عباس'},
  {code:'53', fr:'In Salah', ar:'عين صالح'}, {code:'54', fr:'In Guezzam', ar:'عين قزام'}, {code:'55', fr:'Touggourt', ar:'تقرت'}, {code:'56', fr:'Djanet', ar:'جانت'},
  {code:'57', fr:"El M'Ghair", ar:'المغير'}, {code:'58', fr:'El Meniaa', ar:'المنيعة'},
  {code:'59', fr:'Aflou', ar:'آفلو'}, {code:'60', fr:'Barika', ar:'بريكة'}, {code:'61', fr:'El Kantara', ar:'القنطرة'}, {code:'62', fr:'Bir El Ater', ar:'بئر العاتر'},
  {code:'63', fr:'El Aricha', ar:'العريشة'}, {code:'64', fr:'Ksar Chellala', ar:'قصر الشلالة'}, {code:'65', fr:'Aïn Ouessara', ar:'عين وسارة'}, {code:'66', fr:'Messaad', ar:'مسعد'},
  {code:'67', fr:'Ksar El Boukhari', ar:'قصر البخاري'}, {code:'68', fr:'Bou Saâda', ar:'بوسعادة'}, {code:'69', fr:'El Abiodh Sidi Cheikh', ar:'الأبيض سيدي الشيخ'}
];

const ROSTOM_COMMUNES_FALLBACK = {
  '05 - Batna': [
    {fr:'Batna', ar:'باتنة'}, {fr:'Douar Eddis', ar:'دوار الديس'}, {fr:'Bouaakal', ar:'بوعقال'}, {fr:'Fesdis', ar:'فسديس'}, {fr:'Oued Chaaba', ar:'وادي الشعبة'},
    {fr:'Aïn Touta', ar:'عين التوتة'}, {fr:'Arris', ar:'آريس'}, {fr:'Ichmoul', ar:'إشمول'}, {fr:"T'Kout", ar:'تكوت'}, {fr:'Merouana', ar:'مروانة'},
    {fr:'Tazoult', ar:'تازولت'}, {fr:"N'Gaous", ar:'نقاوس'}, {fr:'Seriana', ar:'سريانة'}, {fr:'El Madher', ar:'المعذر'}, {fr:'Aïn Yagout', ar:'عين ياقوت'},
    {fr:'Bouzina', ar:'بوزينة'}, {fr:'Chemora', ar:'شمرة'}, {fr:'Djezzar', ar:'الجزار'}, {fr:'Foum Toub', ar:'فم الطوب'},
    {fr:'Ghassira', ar:'غسيرة'}, {fr:'Kimmel', ar:'كيمل'}, {fr:'Menaa', ar:'منعة'}, {fr:'Teniet El Abed', ar:'ثنية العابد'}, {fr:'Timgad', ar:'تيمقاد'}
  ],
  '16 - Alger': [{fr:'Alger Centre', ar:'الجزائر الوسطى'}, {fr:'Hydra', ar:'حيدرة'}, {fr:'Bab Ezzouar', ar:'باب الزوار'}, {fr:'Kouba', ar:'القبة'}, {fr:'Cheraga', ar:'الشراقة'}],
  '31 - Oran': [{fr:'Oran', ar:'وهران'}, {fr:'Bir El Djir', ar:'بئر الجير'}, {fr:'Es Senia', ar:'السانية'}, {fr:'Aïn El Turk', ar:'عين الترك'}],
  '59 - Aflou': [{fr:'Aflou', ar:'آفلو'}],
  '60 - Barika': [{fr:'Barika', ar:'بريكة'}, {fr:'Djezzar', ar:'الجزار'}, {fr:'Bitam', ar:'بيطام'}],
  '61 - El Kantara': [{fr:'El Kantara', ar:'القنطرة'}],
  '62 - Bir El Ater': [{fr:'Bir El Ater', ar:'بئر العاتر'}],
  '63 - El Aricha': [{fr:'El Aricha', ar:'العريشة'}],
  '64 - Ksar Chellala': [{fr:'Ksar Chellala', ar:'قصر الشلالة'}],
  '65 - Aïn Ouessara': [{fr:'Aïn Ouessara', ar:'عين وسارة'}],
  '66 - Messaad': [{fr:'Messaad', ar:'مسعد'}],
  '67 - Ksar El Boukhari': [{fr:'Ksar El Boukhari', ar:'قصر البخاري'}],
  '68 - Bou Saâda': [{fr:'Bou Saâda', ar:'بوسعادة'}],
  '69 - El Abiodh Sidi Cheikh': [{fr:'El Abiodh Sidi Cheikh', ar:'الأبيض سيدي الشيخ'}]
};

function wilayaValue(w){ return `${String(w.code).padStart(2,'0')} - ${w.fr}`; }
function locationLabel(item, lang){ return lang === 'ar' ? (item.ar || item.fr) : (item.fr || item.ar); }
function normalizeWilaya(code, fr, ar){ return {code:String(code).padStart(2,'0'), fr:String(fr||'').trim(), ar:String(ar||fr||'').trim()}; }

function ensureEveryWilayaHasAtLeastOneCommune(data){
  data.wilayas.forEach(w => {
    const key = wilayaValue(w);
    if(!data.communesByWilaya[key] || !data.communesByWilaya[key].length){
      data.communesByWilaya[key] = [{fr:w.fr, ar:w.ar}];
    }
  });
  return data;
}

function fallbackLocationData(){
  return ensureEveryWilayaHasAtLeastOneCommune({wilayas: ROSTOM_WILAYAS_FALLBACK, communesByWilaya: {...ROSTOM_COMMUNES_FALLBACK}, source:'fallback-69'});
}

function normalizeRemoteCommunes(rows){
  const byCode = new Map(ROSTOM_WILAYAS_FALLBACK.map(w => [w.code, w]));
  const communesByWilaya = {...ROSTOM_COMMUNES_FALLBACK};
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const code = String(row.wilaya_code || row.wilayaCode || row.code_wilaya || '').padStart(2,'0');
    const fr = row.wilaya_name_fr || row.wilayaNameFr || row.wilaya || row.province || '';
    const ar = row.wilaya_name_ar || row.wilayaNameAr || row.wilaya_ar || fr;
    const communeFr = row.commune_name_fr || row.communeNameFr || row.name_fr || row.commune || row.name || '';
    const communeAr = row.commune_name_ar || row.communeNameAr || row.name_ar || communeFr;
    if(!code || !fr || !communeFr) return;
    const w = normalizeWilaya(code, fr, ar);
    if(Number(w.code) >= 1 && Number(w.code) <= 69) byCode.set(w.code, w);
    const key = wilayaValue(byCode.get(w.code) || w);
    if(!communesByWilaya[key]) communesByWilaya[key] = [];
    if(!communesByWilaya[key].some(c => c.fr === communeFr)) communesByWilaya[key].push({fr:communeFr, ar:communeAr});
  });
  const wilayas = Array.from(byCode.values()).sort((a,b)=>Number(a.code)-Number(b.code));
  return ensureEveryWilayaHasAtLeastOneCommune({wilayas, communesByWilaya, source:'geoalgeria-plus-local-69'});
}

async function loadLocationData(){
  try{
    const cached = JSON.parse(localStorage.getItem(ROSTOM_LOCATION_CACHE_KEY) || 'null');
    if(cached && cached.wilayas && cached.communesByWilaya && cached.wilayas.length >= 69) return cached;
  }catch{}
  try{
    const res = await fetch(ROSTOM_REMOTE_COMMUNES_URL, {cache:'force-cache'});
    if(!res.ok) throw new Error('locations fetch failed');
    const rows = await res.json();
    const data = normalizeRemoteCommunes(rows);
    try{ localStorage.setItem(ROSTOM_LOCATION_CACHE_KEY, JSON.stringify(data)); }catch{}
    return data;
  }catch{
    const data = fallbackLocationData();
    try{ localStorage.setItem(ROSTOM_LOCATION_CACHE_KEY, JSON.stringify(data)); }catch{}
    return data;
  }
}
