/* AKTIVA / İrsaliye ayrıştırıcı V10.
 * Konum, firma/alıcı ayrımı, birimler ve tablo satırlarında güvenli tahmin.
 * Metin kullanıcı onayı olmadan hiçbir zaman doğrudan kaydedilmez.
 */
(function(root){'use strict';
 const upper=x=>String(x||'').toLocaleUpperCase('tr-TR');
 const fold=x=>upper(x).replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C');
 const clean=x=>String(x||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\u00A0\t]/g,' ').replace(/\s+/g,' ').trim();
 const linesOf=x=>String(x||'').split(/\r?\n/).map(clean).filter(Boolean);
 const signature=x=>fold(x).replace(/[^A-Z0-9]/g,'');
 const qty=s=>{const x=clean(s).replace(/\s/g,'').replace(/\./g,'').replace(/,/g,'.');if(!/^\d+(?:\.0+)?$/.test(x))return null;const n=Number(x);return Number.isSafeInteger(n)&&n>=0&&n<=999999?n:null};
 // Kullanıcının KASA PALET KODLARI.xlsx referans dosyasındaki tam eşleşmeler.
 // Prefix üzerinden tür türetilmez: 9900145 bir KASA kodudur.
 const PACKAGING_REFERENCE=Object.freeze({"9900351":{"name":"PALET EURO-TURPAL 80X120CM BİRPAL","type":"palet"},"9900352":{"name":"PALET DÜSSELDORF-TURPAL 60X80CM BİRPAL","type":"palet"},"9900353":{"name":"PALET EURO-TURPAL 80X120CM PCS","type":"palet"},"9900354":{"name":"PALET DÜSSELDORF-TURPAL 60X80CM PCS","type":"palet"},"9900355":{"name":"PALET EURO-TURPAL 80X120CM PRESTİJ","type":"palet"},"9900356":{"name":"PALET DÜSSELDORF-TURPAL 60X80CM PRESTİJ","type":"palet"},"9900360":{"name":"PALET EURO-TURPAL 80X120CM P.GLOBAL","type":"palet"},"9900362":{"name":"PALET DÜSSELDORF-TURPAL 60X80CM P.GLOBAL","type":"palet"},"9900022":{"name":"PALET EURO-TURPAL 80X120CM PALEX","type":"palet"},"9900023":{"name":"PALET DÜSSELDORF-TURPAL 60X80CM PALEX","type":"palet"},"9900369":{"name":"PALET EURO-TURPAL 80X120 CM RENTAPAL","type":"palet"},"9900370":{"name":"PALET DÜSSELDORF-TURPAL 60X80 CM RENTAPAL","type":"palet"},"9900363":{"name":"PALET EURO-TURPAL 80X120CM TEDARİKÇİ","type":"palet"},"9900364":{"name":"PALET DÜSSLDORF-TURPAL 60X80CM TEDARİKÇİ","type":"palet"},"9800011":{"name":"YOĞURT KASASI","type":"kasa"},"9800012":{"name":"SEBZE KASASI","type":"kasa"},"9800145":{"name":"IFCO YOĞURT KASASI","type":"kasa"},"9800036":{"name":"TRENTO BÜYÜK KATLANABİLİR KASA 64","type":"kasa"},"9900145":{"name":"KASA KATLANIR YOĞURT 4419 IFCO","type":"kasa"},"9900175":{"name":"KARPUZ BOX BÜYÜK","type":"kasa"},"9800042":{"name":"KARPUZ BOX KÜÇÜK","type":"kasa"},"9800034":{"name":"TRENTO KÜÇÜK KATLANABİLİR KASA 64","type":"kasa"}});
 const packagingReference=code=>PACKAGING_REFERENCE[String(code||'').replace(/\D/g,'')]||null;
 const knownCodeIn=text=>{const m=String(text||'').match(/(?:^|\D)(?:98|99)\d{5}(?!\d)/g)||[];for(const raw of m){const code=raw.replace(/\D/g,'');if(packagingReference(code))return code}return ''};
 function packagingKind(row){
  const code=packagingReference(row.sku)?String(row.sku):knownCodeIn(row.name);
  if(code)return {code,type:PACKAGING_REFERENCE[code].type,name:PACKAGING_REFERENCE[code].name,known:true};
  const name=fold(row.name||'');
  // Gerçek ürünlerin içindeki genel 'kasa' kelimesini tek başına ambalaj sanma.
  if(/^(?:\d{1,3}\s+)?(?:PALET|PALLET|PLT)\b/.test(name)||/\b(?:TURPAL|PALEX)\b/.test(name))return {code:row.sku||'',type:'palet',name:clean(row.name),known:false};
  if(/^(?:(?:IFCO|TRENTO|SEBZE|YOGURT|KARPUZ)\s+)?(?:KASA|BOX)\b/.test(name)||/\b(?:KASASI|KATLANABILIR\s+KASA|KATLANIR\s+KASA|KARPUZ\s+BOX)\b/.test(name))return {code:row.sku||'',type:'kasa',name:clean(row.name),known:false};
  return null;
 }
 const heading=x=>/^(?:SIRA(?:\s+NO)?|MAL\s*$|MALZEME(?:\s+(?:KODU|TANIMI))?|ÜRÜN(?:\s+(?:ADI|KODU))?|STOK\s+KODU|KALEM|BIRIM|MIKTAR|TOPLAM|VERGI|IRSALIYE|BELGE\s+NO|TARIH|SAYFA|VKN|ETTN|TCKN|ARAC\s+PLAKA|ACIKLAMALAR|TASIYICI|TELEFON|ADRES)/.test(fold(x));
 const footer=x=>/^(?:TASIYICI\s+BILGILERI|ACIKLAMALAR|TESLIM\s+ALAN|GENEL\s+TOPLAM|ODENECEK|TOPLAM\s+(?:KDV|TUTAR)|BANKA|KREDI\s+KARTI)/.test(fold(x));
 // E-irsaliye no: üç harfli seri + 4 haneli yıl + 9 haneli sıra.
 // "e-İrsaliye" başlığı veya "İrsaliye Tarihi" numara etiketi DEĞİLDİR.
 function invoiceFrom(lines){
  const label=/(?:^|[\s|])(?:E\s*-?\s*)?(?:SEVK\s+)?IRSALIYE\s*(?:NO(?:SU)?|NUMARASI|NUM|#)\b|\bBELGE\s*(?:NO(?:SU)?|NUMARASI)\b/;
  const standard=/[A-Z]{3}20[0-9OIS]{2}[0-9OISBL]{9}/g;
  const ignore=/(?:ETTN|UUID|VKN|TCKN|PLAKA|SAP\s*BELGE|MUSTERI\s+NO|TESLIMAT\s*NO|TELEFON|IBAN)/;
  const opts=[];
  const normalize=v=>v.toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^([A-Z]{3})20([0-9OIS]{2})([0-9OISBL]{9})$/,
   (_,series,year,serial)=>series+'20'+year.replace(/O/g,'0').replace(/[IS]/g,'1')+serial.replace(/[O]/g,'0').replace(/[I L]/g,'1').replace(/S/g,'5').replace(/B/g,'8'));
  lines.forEach((line,i)=>{
   const u=fold(line);if(ignore.test(u))return;
   const hasLabel=label.test(u),pos=hasLabel?u.search(label):-1;
   const tail=hasLabel?u.slice(pos+u.slice(pos).match(label)[0].length).replace(/^[\s:#=.|-]+/,''):'';
   const contexts=[{value:tail,score:33},{value:hasLabel?fold(lines[i+1]||''):'',score:22},{value:u,score:hasLabel?30:8}];
   for(const context of contexts){
    if(!context.value||ignore.test(context.value))continue;
    const joined=context.value.replace(/\s+(?=[0-9]{4,})/g,'').replace(/([A-Z]{3})\s+(20)/g,'$1$2');
    standard.lastIndex=0;
    for(const m of joined.matchAll(standard)){
     const before=joined[m.index-1]||'',after=joined[m.index+m[0].length]||'';
     if(/[A-Z0-9]/.test(before)||/[A-Z0-9]/.test(after))continue;
     const value=normalize(m[0]);
     if(/^[A-Z]{3}20\d{11}$/.test(value))opts.push({value,score:context.score,index:i});
    }
   }
  });
  opts.sort((a,b)=>b.score-a.score||a.index-b.index);
  // Kodu hiç göremediysek ilişkili başka bir numarayı uydurup koyma.
  return opts[0]||{value:'',score:0};
 }
 function supplierFrom(lines){
  const sayin=lines.findIndex(x=>/^(?:SAYIN|ALICI|MUSTERI|TESLIM\s+ALAN)\b/.test(fold(x)));
  const key=/(?:GONDEREN\s*FIRMA|GONDEREN|SATICI\s*FIRMA|SATICI|TEDARIKCI|SEVK\s+EDEN|DUZENLEYEN|FIRMA\s+ADI)\s*(?:FIRMA(?:SI)?|ADI|UNVANI)?\s*[:=-]?\s*/;
  const company=/(?:\bA\.?S\.?\b|\bLTD\.?\b|\bSTI\.?\b|\bSAN\.?\b|\bTIC\.?\b|\bGIDA\b|\bMAGAZALAR\b|\bLOJISTIK\b|\bURETIM\b)/;
  const bad=/(?:SAYIN|ALICI|MUSTERI|TESLIM\s+ALAN|SEVK\s+ADRESI|DEPO\s+ADRESI|VERGI\s+DAIRESI|KODU|MALZEME|PLAKA|FATURA|IRSALIYE)/;
  const candidates=[];
  lines.forEach((line,i)=>{
   const norm=fold(line);if(bad.test(norm))return;
   const m=norm.match(key);
   if(m){const v=clean(line.slice(m.index+m[0].length));if(v.length>4&& !/^\d{5,}/.test(v))candidates.push({value:v,score:17,index:i});
    if(v.length<4&&lines[i+1]&&!heading(lines[i+1]))candidates.push({value:lines[i+1],score:13,index:i+1});}
   if(line.length>=8&&line.length<=145&&company.test(norm)&&!/^\d{4,}/.test(norm)&&!/(?:\d{6,}|@|https?:|www\.)/.test(norm)){
    const before=sayin===-1||i<sayin;
    const score=before?i<13?13:8:3;
    candidates.push({value:line,score,index:i});
   }
  });
  candidates.sort((a,b)=>b.score-a.score||a.index-b.index);
  let top=candidates[0]||{value:'',score:0};
  return {...top,value:top.value.replace(/^\d{5,12}\s*[-:]\s*/,'').trim().slice(0,150)};
 }
 // OCR Türkçe plakalarda harf/rakam karışıklıklarına yatkındır. Düzeltmeleri
 // yalnızca plaka etiketinin yakınında ve plakanın doğru segmentinde uygula.
 function plateFrom(lines){
  const normalized=lines.map(fold),seen=new Map(),hints=[];
  const plateLabel=/(?:ARAC|CEKICI|KAMYON|TIR|VASITA|TASIT|SEVK\s+ARACI|DORSE|ROMORK)?\s*PLAKA(?:SI)?(?:\s+(?:NUMARASI|NO))?|ARAC\s+NO/;
  const anyLabel=/(?:ARAC|CEKICI|DORSE|ROMORK)?\s*PLAKA(?:SI)?(?:\s+(?:NUMARASI|NO))?/g;
  const province=t=>t.replace(/[OS]/g,x=>x==='O'?'0':'5').replace(/[IL]/g,'1').replace(/B/g,'8');
  const digits=t=>t.replace(/[OQ]/g,'0').replace(/[ILS]/g,x=>x==='S'?'5':'1').replace(/B/g,'8');
  const letters=t=>t.replace(/0/g,'O').replace(/1/g,'I').replace(/5/g,'S').replace(/8/g,'B');
  const candidates=/(^|[^A-Z0-9])([0-9OSIBL]{2})[\s.\/-]*([A-Z0158]{1,3})[\s.\/-]*([0-9OQISBL]{2,5})(?![A-Z0-9])/g;
  function add(segment,index,label,kind,base){
   const u=fold(segment),isTrailer=kind==='trailer';let m;
   candidates.lastIndex=0;
   while((m=candidates.exec(u))){
    const pr=province(m[2]),letPart=letters(m[3]),num=digits(m[4]);
    if(!/^\d{2}$/.test(pr)||Number(pr)<1||Number(pr)>81||!/^[A-Z]{1,3}$/.test(letPart)||!/^\d{2,5}$/.test(num))continue;
    const repaired=pr!==m[2]||letPart!==m[3]||num!==m[4];
    // Etiketsiz OCR'dan yapılan onarımları güvenilir kabul etme.
    if(repaired&&!label)continue;
    const value=pr+' '+letPart+' '+num;
    const score=base+(isTrailer?-5:0)-(repaired?4:0);
    const key=value+'|'+(isTrailer?'dorse':'arac');
    const prev=seen.get(key);if(!prev||score>prev.score)seen.set(key,{value,score,index,repaired,role:isTrailer?'dorse':'arac',original:m[0].trim()});
   }
  }
  normalized.forEach((line,i)=>{
   const labels=[...line.matchAll(anyLabel)];
   if(labels.length){
    for(let n=0;n<labels.length;n++){
     const hit=labels[n],beg=hit.index+hit[0].length,end=n+1<labels.length?labels[n+1].index:line.length;
     const prefix=line.slice(Math.max(0,hit.index-20),hit.index+hit[0].length);
     const isTrailer=/(?:DORSE|ROMORK)/.test(prefix);
     const beforeCount=seen.size;add(line.slice(beg,end),i,true,isTrailer?'trailer':'truck',isTrailer?17:26);
     if(seen.size===beforeCount){for(let j=1;j<=2;j++)if(normalized[i+j]&&!plateLabel.test(normalized[i+j]))add(normalized[i+j],i+j,true,isTrailer?'trailer':'truck',16-j*3)}
    }
   }else{
    add(line,i,false,'truck',3);
   }
   if(plateLabel.test(line)&&!/[0-9]{2}\s*[A-Z]{1,3}\s*[0-9]{2,5}/.test(line))hints.push(line.slice(-38));
  });
  const list=[...seen.values()].sort((a,b)=>b.score-a.score||a.index-b.index);
  const trucks=list.filter(x=>x.role==='arac'),trailers=list.filter(x=>x.role==='dorse');
  const top=trucks[0]||{value:'',score:0},trailer=trailers[0]||{value:'',score:0};
  return {...top,trailer:trailer.value,trailerScore:trailer.score,
   hint:!top.value?hints.find(Boolean)||'':'',
   ambiguous:trucks.some(x=>x.value!==top.value&&x.score>=top.score-5),
   repaired:!!top.repaired,
   candidates:list.slice(0,6).map(x=>({value:x.value,role:x.role,review:x.repaired}))};
 }
 function palletFrom(lines){
  const opts=[];const add=(str,score,i)=>{const n=qty(str);if(n!==null)opts.push({value:n,score,index:i})};
  lines.forEach((line,i)=>{const x=fold(line);let m;
   if((m=x.match(/(?:GENEL\s+TOPLAM\s+|TOPLAM\s+)?(?:PALET|PALLET|PLT)\s*(?:SAYISI|ADEDI|MIKTARI|TOPLAMI)?\s*[:=\-]\s*(\d{1,6})\b/)))add(m[1],/TOPLAM/.test(x)?14:11,i);
   if((m=x.match(/(?:GENEL\s+TOPLAM\s+|TOPLAM\s+)?(?:PALET|PALLET|PLT)\s+(?:SAYISI\s+|ADEDI\s+)?(\d{1,6})\b/)))add(m[1],/TOPLAM/.test(x)?14:10,i);
   if((m=x.match(/\b(?:GENEL\s+TOPLAM|TOPLAM)\s*[:=\-]?\s*(\d{1,6})\s*(?:PALET|PALLET|PLT)\b/)))add(m[1],14,i);
   if(/^(?:TOPLAM\s+)?(?:PALET|PALLET|PLT)(?:\s+(?:SAYISI|ADEDI|MIKTARI|TOPLAMI))?\s*[:=\-]?\s*$/.test(x)&&lines[i+1]&&/^\d{1,6}$/.test(lines[i+1]))add(lines[i+1],9,i+1);
   if(x.length<24&&(m=x.match(/^(\d{1,6})\s*(?:PALET|PALLET|PLT)$/)))add(m[1],5,i);
  });
  opts.sort((a,b)=>b.score-a.score||a.index-b.index);const top=opts[0]||{value:null,score:0};return {...top,ambiguous:opts.some(x=>x.value!==top.value&&x.score>=top.score-2)};
 }
 // İrsaliyelerde K. Ad. sütunu koli adedi anlamına gelebilir ama
 // son sütun 'Adet' ise otomatik olarak koliye çevirmek güvenli DEĞİLDİR.
 function productFromLine(original,inTable){
  let s=clean(original),u=fold(s);if(s.length<8||footer(s)||heading(s)||/\b(?:VKN|TCKN|ETTN|VERGI|TELEFON|PLAKA|IBAN|KS:|SAYFA|TOPLAM\s+TUTAR|BAYI|MERSIS)\b/.test(u))return null;
  let unit='unknown',rawAmount=null,pallets=0,core=s,code='';
  // Mimari: geniş boşluklara dayanmadan, tabloda '8450 Adet' veya '8450 Koli' yakala.
  const explicit=[...s.matchAll(/(\d{1,6}(?:[.,]\d{3})?(?:,0+)?)\s*[|;):]?\s*(KOL[Iİ]|KOL\.?|KT|ADET|AD|PALET|PALLET|PLT|PAKET)\b/gi)];
  if(explicit.length){const hit=explicit.find(x=>/KOL[Iİ]|KT/i.test(x[2]))||explicit[explicit.length-1];rawAmount=qty(hit[1]);unit=/KOL[Iİ]|KT/i.test(hit[2])?'koli':/PALET|PALLET|PLT/i.test(hit[2])?'palet':/PAKET/i.test(hit[2])?'paket':'adet';core=clean(s.slice(0,hit.index));const after=s.slice(hit.index+hit[0].length);const cm=after.match(/^\s*[|;:]?\s*(\d{5,10})\b/);if(cm)code=cm[1];}
  else if(inTable){const m=s.match(/^(.*?)\s+(\d{1,6}(?:[.,]\d{3})?)(?:\s+\d{1,6}(?:[.,]\d{3})?){0,2}\s*$/);if(m){core=m[1];rawAmount=qty(m[2]);unit='unknown';}}
  if(rawAmount===null||rawAmount===0)return null;
  // Palet stok kodunun (örn. 9900022) bir rakamı OCR'da kaybolduğunda
  // 900022 gibi bir değer hayali bir ürünün palet miktarı sanılabiliyor.
  // Beş ve üzeri haneli 'palet' miktarı gerçek satır olarak kabul edilmez.
  if(unit==='palet'&&rawAmount>=10000)return null;
  // Ürün adının sonundan K. İçi / K. Ad / Toplam numeric hücrelerini kaldır.
  core=core.replace(/(?:\s+[\d.,]+){1,4}\s*$/,'').replace(/^\s*\d{1,3}\s+(?=\d{5,14}\b)/,'');
  const match=core.match(/^(?:\d{1,3}\s*[|;.\-]?\s+)?(\d{5,14}|[A-Z]{1,4}[-/]\d{4,14})\s+(.+)$/i);
  if(match){if(!code)code=match[1];core=match[2];}
  core=clean(core.replace(/^(?:[|!iıI\]\[.,\s]+)+/g,'').replace(/^\d{1,3}(?:[.)-])?\s+(?=[A-Za-zÇĞİÖŞÜçğıöşü])/, '').replace(/^[|;\s]+|[|;\s]+$/g,''));
  const title=fold(core);
  if(core.length<7||core.length>200||(core.match(/[a-zA-ZçğıöşüÇĞİÖŞÜ]{3,}/g)||[]).length<2||heading(core)||/^(?:K\.?\s*(?:ICI|AD)|BIRIM|TOPLAM|MIKTAR|SIRA\s*NO|BELGE)/.test(title))return null;
  const pm=s.match(/\b(\d{1,5})\s*(?:PALET|PALLET|PLT)\b/i);if(pm&&unit==='koli'&&!/^(?:\d{1,3}\s+)?(?:PALET|PALLET|PLT)\b/i.test(core))pallets=Number(pm[1]);
  return {name:core,sku:code,cartons:unit==='koli'?rawAmount:null,rawAmount,unit,pallets,review:unit!=='koli'||!inTable};
 }
 // Tesseract TSV'sinde her kelimenin gerçek x/y konumu vardır. Miktar ve
 // birim aynı yatay ürün satırında aranır: diğer sütunların (sipariş no vb.)
 // içeriği ürün adına asla eklenmez. Ürünler çizgisiz tablolarda da çalışır.
 function parseTableTSV(tsv){
  if(!tsv||typeof tsv!=='string')return [];
  const words=[];
  for(const line of tsv.split(/\r?\n/).slice(1)){
   const c=line.split('\t');if(c.length<12||Number(c[0])!==5)continue;
   const token=clean(c.slice(11).join(' ')),x=Number(c[6]),y=Number(c[7]),w=Number(c[8]),h=Number(c[9]),conf=Number(c[10]);
   if(!token||!Number.isFinite(x)||!Number.isFinite(y)||w<1||h<1||conf<0)continue;
   words.push({text:token,x,y,w,h,mid:y+h/2,conf});
  }
  if(words.length<3)return [];
  // En sık görülen yazı yüksekliği y toleransını belirler. Başlık/sipariş
  // sütunları OCR tarafından ayrı bloklara bölünse de aynı satıra alınır.
  const heights=words.map(w=>w.h).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||20;
  const result=[];const qtyCandidates=[];
  const unitRx=/(?:^|[^\d])(\d{1,6}(?:[.,]\d{3})?)\s*[|;):.\-İIıi]{0,2}\s*(KOL[Iİ]|KOL\.?|KT|ADET|AD\.?|PALET|PALLET|PLT|PAKET)\b/i;
  // Birim ve miktar OCR'da ayrı kelimeler de olabilir.
  const spatial=words.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
  for(const w of spatial){
   const nearby=spatial.filter(v=>v.x>w.x&&v.x-w.x<Math.max(175,w.h*7)&&Math.abs(v.mid-w.mid)<median*1.2).sort((a,b)=>a.x-b.x).slice(0,2);
   for(const sample of [w.text,w.text+' '+nearby.map(v=>v.text).join(' ')]){
    const m=sample.match(unitRx);if(!m)continue;
    const n=qty(m[1]);if(n===null||n===0)continue;
    const unit=/KOL[Iİ]|KT/i.test(m[2])?'koli':/PALET|PALLET|PLT/i.test(m[2])?'palet':/PAKET/i.test(m[2])?'paket':'adet';
    if(!qtyCandidates.some(c=>c.w===w))qtyCandidates.push({w,n,unit});break;
   }
  }
  for(const {w:q,n,unit} of qtyCandidates){
   // Aynı satırın tamamını yatay konumdan kur. Farklı x sütunlarının
   // başlıklarını/üstteki sipariş açıklamasını ürün adına katma.
   const onRow=spatial.filter(w=>Math.abs(w.mid-q.mid)<=Math.max(12,median*1.45)&&!qtyCandidates.some(other=>other.w!==q&&Math.abs(other.w.mid-w.mid)+2<Math.abs(q.mid-w.mid)));
   const left=onRow.filter(w=>w.x+w.w*.5<q.x&&w.conf>=36).sort((a,b)=>a.x-b.x);
   let name=clean(left.map(w=>w.text).join(' '))
    .replace(/^(?:[iIı|!.,;:\-\[\]]+\s*)+/g,'')
    .replace(/^\d{1,3}\s+(?=[A-Za-zÇĞİÖŞÜçğıöşü])/,'');
   let sku='';
   const after=onRow.filter(w=>w.x>=q.x+q.w*.5).sort((a,b)=>a.x-b.x);
   for(const word of after){const code=word.text.match(/^(\d{5,10})$/);if(code&&code[1]!==String(n)){sku=code[1];break}}
   if(!sku){const embedded=name.match(/^(?:\d{1,3}\s+)?(\d{5,14})\s+(.+)$/);if(embedded){sku=embedded[1];name=embedded[2]}}
   const normalized=fold(name);
   if(name.length<8||name.length>200||(name.match(/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/g)||[]).length<2||heading(name)||footer(name)||/\b(?:ETTN|VKN|TCKN|PLAKA|SIPARIS\s+NO)\b/.test(normalized))continue;
   const duplicated=result.some(v=>signature(v.name)===signature(name)&&v.rawAmount===n);
   if(!duplicated)result.push({name,sku,cartons:unit==='koli'?n:null,rawAmount:n,unit,pallets:0,review:unit!=='koli',source:'tablo-konumu'});
  }
  return result;
 }
 // Euro palet satırının küçük miktar hücresi, tam tablo OCR'ında
 // çizgilerle birleşebiliyor. TSV koordinatlarıyla sadece o hücreye bakılır.
 // Kesin sayı bu fonksiyonda üretilmez; fotoğraf tekrar OCR edilir.
 // Palet türü EURO/PLASTİK/AHŞAP vb. olabilir. Tür adını zorunlu tutma.
 // Yalnızca miktar sütununun aynı hizasındaki palet kalemini hedefle.
 function findDepotCell(tsv,width,height){
  if(!tsv||!width||!height)return null;
  const words=[];
  for(const line of String(tsv).split(/\r?\n/).slice(1)){
   const c=line.split('\t');if(c.length<12||Number(c[0])!==5)continue;
   const value=clean(c.slice(11).join(' ')),x=Number(c[6]),y=Number(c[7]),w=Number(c[8]),h=Number(c[9]);
   if(value&&Number.isFinite(x)&&Number.isFinite(y)&&w>0&&h>0)words.push({text:value,x,y,w,h,mid:y+h/2});
  }
  const targets=words.filter(w=>/^(?:PALET|PALLET|PLT|TURPAL|PALEX)$/i.test(w.text)&&w.x<width*.63);
  if(!targets.length)return null;
  const headings=words.filter(w=>/MIKTAR|KOL[Iİ]|ADET/i.test(fold(w.text))&&w.y<height*.65);
  let options=[];
  for(const w of targets){
   // Palet tek başına belge başlığında geçiyorsa tablo satırı sanma.
   const same=words.filter(v=>Math.abs(v.mid-w.mid)<Math.max(24,w.h*1.7));
   if(same.length<3||!same.some(v=>v!==w&&v.x>w.x))continue;
   const anchors=headings.filter(v=>v.y<w.y&&v.x>w.x+width*.035&&v.x<width*.75)
    .sort((a,b)=>Math.abs(a.x-width*.54)-Math.abs(b.x-width*.54));
   const otherQuantities=words.filter(v=>/^(?:\d{1,6}(?:[.,]\d{3})?|ADET|KOL[Iİ])$/i.test(v.text)&&v.x>w.x+width*.05&&v.x<width*.74)
    .sort((a,b)=>Math.abs(a.mid-w.mid)-Math.abs(b.mid-w.mid));
   const x=anchors[0]?.x??otherQuantities[0]?.x??width*.54;
   options.push({mid:w.mid,x,score:(anchors.length?3:0)+(same.some(v=>/^(?:EURO|PLASTIK|AH[SŞ]AP|TURPAL|PALEX)$/i.test(v.text))?2:0)});
  }
  options.sort((a,b)=>b.score-a.score);
  if(!options.length||options.slice(1).some(v=>v.score===options[0].score&&Math.abs(v.mid-options[0].mid)>55))return null;
  const {mid,x}=options[0];
  const left=Math.max(0,Math.floor(x-Math.max(80,width*.045))),right=Math.min(width,Math.ceil(x+Math.max(300,width*.14)));
  const top=Math.max(0,Math.floor(mid-Math.max(45,height*.025))),bottom=Math.min(height,Math.ceil(mid+Math.max(48,height*.028)));
  return right-left>=120&&bottom-top>=30?{left,top,width:right-left,height:bottom-top}:null;
 }
 // Birden fazla palet/kasa satırında her kodun miktar hücresini ayrı oku.
 // Kod yoksa 'diğer palet/kasa' için yanlış satıra miktar atamamak adına tahmin yapma.
 function findPackagingCells(tsv,width,height){
  if(!tsv||!width||!height)return [];
  const words=[];
  for(const line of String(tsv).split(/\r?\n/).slice(1)){
   const c=line.split('\t');if(c.length<12||Number(c[0])!==5)continue;
   const value=clean(c.slice(11).join(' ')),x=Number(c[6]),y=Number(c[7]),w=Number(c[8]),h=Number(c[9]);
   if(value&&Number.isFinite(x)&&Number.isFinite(y)&&w>0&&h>0)words.push({value,x,y,w,h,mid:y+h/2});
  }
  const byCode=new Map();
  for(const w of words){
   const code=knownCodeIn(w.value);if(!code||byCode.has(code))continue;
   const same=words.filter(v=>Math.abs(v.mid-w.mid)<Math.max(26,w.h*1.9));
   const label=same.map(v=>v.value).join(' ');
   if(!/(?:PALET|PALLET|PLT|KASA|KASASI|BOX|TURPAL|IFCO)/i.test(fold(label)))continue;
   const headers=words.filter(v=>v.y<w.y&&v.y>0&&/MIKTAR|ADET|BIRIM/i.test(fold(v.value))&&v.x>w.x+width*.06&&v.x<width*.82)
    .sort((a,b)=>Math.abs(a.x-width*.55)-Math.abs(b.x-width*.55));
   const numbers=same.filter(v=>v.x>w.x+width*.06&&v.x<width*.82&&/^(?:\d{1,6}|ADET|KOL[Iİ])$/i.test(v.value));
   // Sağdaki Adet kelimesi birim sütununun başındadır; miktar soldaki hücrededir.
   // Tek haneli görünümde 15'in başındaki ince '1' kesilmesin diye
   // miktar ile birimi beraber ve geniş sol payla tara.
   const x=headers[0]?.x??numbers[0]?.x??width*.54;
   const left=Math.max(0,Math.floor(x-Math.max(210,width*.115))),right=Math.min(width,Math.ceil(x+Math.max(315,width*.17)));
   const top=Math.max(0,Math.floor(w.mid-Math.max(40,height*.020))),bottom=Math.min(height,Math.ceil(w.mid+Math.max(42,height*.022)));
   if(right-left>130&&bottom-top>30)byCode.set(code,{code,rectangle:{left,top,width:right-left,height:bottom-top}});
  }
  return [...byCode.values()].slice(0,15);
 }
 // İrsaliye No etiketinin karşısındaki dar hücreyi yüksek çözünürlükle tekrar oku.
 function findInvoiceCell(tsv,width,height){
  if(!tsv||!width||!height)return null;
  const words=[];
  for(const line of String(tsv).split(/\r?\n/).slice(1)){
   const c=line.split('\t');if(c.length<12||Number(c[0])!==5)continue;
   const value=fold(c.slice(11).join(' ')),x=Number(c[6]),y=Number(c[7]),w=Number(c[8]),h=Number(c[9]),conf=Number(c[10]);
   if(value&&Number.isFinite(x)&&Number.isFinite(y)&&w>0&&h>0&&conf>=12)words.push({value,x,y,w,h,mid:y+h/2});
  }
  const options=[];
  for(const word of words){
   if(!/IRSALIYE/.test(word.value))continue;
   const nearby=words.filter(v=>v!==word&&Math.abs(v.mid-word.mid)<Math.max(word.h*1.5,25));
   const no=nearby.find(v=>/^(?:NO|NO:|NOSU|NUMARASI)$/.test(v.value)&&v.x>=word.x);
   // "İrsaliye Tarihi" ve yalnız "e-İrsaliye" başlıklarına göre hücre açma.
   if(!no)continue;
   const x=Math.min(width-1,Math.floor(no.x+no.w+4)),left=Math.max(0,x-12),top=Math.max(0,Math.floor(word.mid-Math.max(28,word.h*1.25)));
   const right=Math.min(width,Math.ceil(x+Math.max(200,width*.24))),bottom=Math.min(height,Math.ceil(word.mid+Math.max(30,word.h*1.35)));
   if(right-left>=100)options.push({left,top,width:right-left,height:bottom-top,score:word.x+no.x});
  }
  options.sort((a,b)=>b.score-a.score);
  return options[0]||null;
 }
 function readFocusedPackagingQuantity(text){
  const m=fold(text).match(/(?:^|[^\d])(\d{1,5})\s*[|;):.\]}JİIıi\-]{0,3}\s*(ADET|AD\.?|KOLI|PALET|PALLET|PAKET)(?=$|[^A-Z0-9])/);
  if(!m)return null;
  const amount=qty(m[1]);if(amount===null||amount===0)return null;
  const unit=/^KOLI$/.test(m[2])?'koli':/^(?:PALET|PALLET)$/.test(m[2])?'palet':m[2]==='PAKET'?'paket':'adet';
  return {amount,unit};
 }
 function readFocusedDepotQuantity(text){
  const parsed=readFocusedPackagingQuantity(text);
  return parsed&&['adet','palet'].includes(parsed.unit)?parsed.amount:null;
 }
 // Birden fazla OCR geçişi aynı ürünü hatalı harflerle yeniden üretebilir.
 // Farklı kodu olan veya farklı miktarlı gerçek ürünleri SİLME.
 function sameProduct(a,b){
  if(a.sku&&b.sku)return a.sku===b.sku;
  const corrupt=x=>/(?:\bIE\s+DAN\b|\bCON\s*5532\b|[<>\[\]]{2,})/.test(fold(x.name));
  // Tek iyi kodlu koli satırının yanında aynı ismin bozuk/eksik kodlu OCR
  // yankısı varsa miktar da yanlış okunmuş olabilir. Birim/miktar farkını
  // yalnız açıkça bozuk satırda görmezden gel.
  const ghost=((!!a.sku&&!b.sku&&corrupt(b))||(!a.sku&&!!b.sku&&corrupt(a)));
  if(!ghost&&a.rawAmount!=null&&b.rawAmount!=null&&a.rawAmount!==b.rawAmount)return false;
  if(!ghost&&a.unit!=='unknown'&&b.unit!=='unknown'&&a.unit!==b.unit)return false;
  const normalize=x=>fold(x).replace(/(?<=\d)[O](?=\d)/g,'0').replace(/[^A-Z0-9]+/g,' ').trim();
  const an=normalize(a.name),bn=normalize(b.name);
  const measures=x=>[...fold(x).matchAll(/\b\d+(?:[.,]\d+)?\s*(?:KG|GR|G|ML|LT|L)\b/g)].map(m=>m[0].replace(/\s/g,'')).sort().join('|');
  const am=measures(a.name),bm=measures(b.name);
  // 100G / 200G gibi gerçekten farklı ambalaj ölçülerini birleştirme.
  if(!ghost&&am&&bm&&am!==bm)return false;
  if(an===bn)return true;
  const aw=an.split(' ').filter(w=>w.length>=3),bw=bn.split(' ').filter(w=>w.length>=3);
  if(aw.length<3||bw.length<3)return false;
  const min=Math.min(aw.length,bw.length);
  const shared=aw.filter(x=>bw.includes(x)).length;
  if(shared>=3&&shared/min>=.70)return true;
  // OCR 100G -> 1006 gibi hata yapınca karakter sıralaması çoğunlukla korunur.
  const compact=x=>x.replace(/\s+/g,'');let a1=compact(an),b1=compact(bn);
  if(Math.min(a1.length,b1.length)<14)return false;
  const len=Math.min(a1.length,b1.length),lim=Math.floor(len*.24);
  // Fazla sonda kalan başlık/sipariş metnini karşılaştırmaya dahil etme.
  a1=a1.slice(0,Math.min(a1.length,len+2));b1=b1.slice(0,Math.min(b1.length,len+2));
  let prev=Array.from({length:b1.length+1},(_,j)=>j);
  for(let i=1;i<=a1.length;i++){
   const row=[i];for(let j=1;j<=b1.length;j++)row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a1[i-1]===b1[j-1]?0:1));
   prev=row;
  }
  return prev[b1.length]<=lim;
 }
 const palletStockName=name=>/^(?:\d{5,14}\s+)?(?:PALET|PALLET|PLT)\b/.test(fold(name)) ||
  /(?:\bPALET\b|\bPALLET\b|\bTURPAL\b|\bPALEX\b)/.test(fold(name))&&
  /(?:\bEURO\b|\bAHSA[P B]\b|\bPLASTIK\b|\bTAHTA\b|\bTURPAL\b|\bPALEX\b|\b80\s*[X*]\s*120\b)/.test(fold(name));
 function dedupeProductRows(rows){
  const result=[];
  const quality=r=>(r.sku?8:0)+(r.unit!=='unknown'?5:0)+(r.rawAmount!=null?5:0)+(r.source==='tablo-konumu'?3:0)-(/\b(?:IE|DAN|CON|5532)\b/.test(fold(r.name))?3:0);
  for(const r of rows){
   const found=result.findIndex(old=>sameProduct(old,r));
   if(found<0){result.push(r);continue}
   const prev=result[found],best=quality(r)>quality(prev)?r:prev,second=best===r?prev:r;
   result[found]={...best,sku:best.sku||second.sku,cartons:best.cartons??second.cartons,rawAmount:best.rawAmount??second.rawAmount,unit:best.unit==='unknown'?second.unit:best.unit};
  }
  return result;
 }
 function parse(raw,options={}){
  const lines=linesOf(raw),invoice=invoiceFrom(lines),supplier=supplierFrom(lines),plate=plateFrom(lines),pal=palletFrom(lines);
  const rows=[],seen=new Set();let table=false,buffer='';
  const emit=(line)=>{const item=productFromLine(line,table);if(!item)return false;
   if(!table&&item.unit==='unknown')return false;
   const key=signature(item.name)+'/'+item.sku+'/'+item.rawAmount;
   if(!seen.has(key)){seen.add(key);rows.push(item)}return true;};
  for(let i=0;i<lines.length&&rows.length<150;i++){
   const line=lines[i],u=fold(line);
   if(footer(line)){table=false;buffer='';continue}
   // Ürün tablosu başlıkları firmadan firmaya değişir. Özellikle
   // "Sıra No | Mal | Miktar | Miktar Birimi" e-İrsaliye şablonunu tanı.
   const isProductHeader=/^(?:MAL|MAL\s*\/\s*HIZMET|MALZEME(?:\s+(?:KODU|TANIMI))?|URUN(?:\s+(?:ADI|KODU|TANIMI))?|STOK\s+KODU|URUN\s*\/\s*HIZMET)$/.test(u)
     || /(?:MALZEME\s+(?:KODU|TANIMI)|URUN\s+ADI|MAL\s*\/\s*HIZMET|STOK\s+KODU)/.test(u)
     || /\bMAL\b.*\bMIKTAR\b/.test(u) || (/^SIRA\s*NO/.test(u)&&/\bMAL\b/.test(fold(lines.slice(i,i+5).join(' '))));
   if(isProductHeader){
    const header=fold(lines.slice(Math.max(0,i-2),i+7).join(' '));
    if(/(?:BIRIM|MIKTAR|KOLI|K\.?\s*AD\.?|TOPLAM)/.test(header)){
     table=true;buffer='';
     // Birden çok satıra bölünmüş başlıkları atla ama veri satırlarını atlama.
     while(i+1<lines.length&&heading(lines[i+1])&&(/K\.?\s*ICI|K\.?\s*AD|TOPLAM|BIRIM|MIKTAR|MALZEME|SIRA|MUSTERI|STOK/.test(fold(lines[i+1]))))i++;
     continue;
    }
   }
   if(/^(?:GENEL\s+TOPLAM|ARA\s+TOPLAM|KS\s*[:=])/.test(u)&&rows.length){table=false;buffer='';continue}
   if(heading(line))continue;
   if(table){
    if(/(?:KOLI|ADET|PALET|PALLET|PLT|PAKET)\b/.test(u)&&emit(line)){buffer='';continue}
    // OCR tabloyu bir satır yerine "ürün adı / miktar / birim"
    // olarak bölebilir; baştaki sıra numarası ve ürün adını birleştir.
    if(/^(?:\d{1,3}\s+)?(?:\d{5,14}\s+)?[A-ZÇĞİÖŞÜa-zçğıöşü][\s\S]{6,}$/.test(line)||/^\d{1,3}\s+\d{5,14}$/.test(line)||buffer){
     if(/^(?:MUSTERI|SIPARIS|MIKTAR|BIRIM|STOK|KOD|NO|TARIH)\b/.test(u)&&!buffer)continue;
     buffer=clean(buffer+' '+line);
     if(/(?:KOLI|ADET|PALET|PALLET|PLT|PAKET)\b/.test(fold(buffer))&&emit(buffer)){buffer='';continue}
     if(buffer.length>320||buffer.split(' ').length>42)buffer='';
    }
   }else if(/(?:KOLI|KOL\.?)\b/.test(u))emit(line);
  }
  // OCR miktar sütununu kaçırsa bile ürün adı bulunmuşsa onu kullanıcıya
  // aday olarak sun; koli/palet bilgisi kesinlikle uydurulmasın.
  if(!rows.length){
   for(let i=0;i<lines.length-1;i++){
    if(!/(?:MALZEME\s+TANIMI|URUN\s+ADI|MAL\s*\/\s*HIZMET)/.test(fold(lines[i])))continue;
    for(let j=i+1;j<=Math.min(lines.length-1,i+3);j++){
     const candidate=lines[j],f=fold(candidate);
     if(heading(candidate))continue;
     if(footer(candidate)||/(?:PLAKA|ETTN|SAYIN|VERGI|TARIH|BIRIM|BAYI|ADRES)/.test(f))break;
     if(candidate.length>8&&candidate.length<145&&/^[A-Za-zÇĞİÖŞÜçğıöşü0-9. -]+$/.test(candidate)&&(candidate.match(/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/g)||[]).length>=3){
      rows.push({name:candidate,sku:'',cartons:null,rawAmount:null,unit:'unknown',pallets:0,review:true});break;
     }
    }
    if(rows.length)break;
   }
  }
  // Tablo kelimeleriyle doğrulanan satırlar, tüm sayfa OCR'ından gelen
  // tahminlere önceliklidir. Farklı taramaların metinlerini birleştirerek
  // asla hayali ikinci/üçüncü ürün üretmeyiz.
  const structured=(Array.isArray(options.tables)?options.tables:[]).flatMap(parseTableTSV);
  // Kontrol edilmiş gerçek tablo satırları, belgenin genel OCR satırlarından önceliklidir.
  const verified=dedupeProductRows(structured);
  const merged=dedupeProductRows(verified.length?[
   ...verified,...rows.filter(r=>r.unit!=='unknown'&&(r.sku||r.rawAmount)&&!verified.some(v=>sameProduct(r,v)))
  ]:rows);
  // Excel'de tanımlı 22 palet/kasa/box kodu tam kod eşleşmesiyle ayrılır.
  // Aynı belgeyi farklı OCR geçişleri okuduğunda aynı satır tekrar ürün olmaz.
  const packagingCandidates=[];
  for(const row of merged){
   const kind=packagingKind(row);
   if(kind)packagingCandidates.push({...row,sku:kind.code||row.sku||'',name:kind.name,kind:kind.type,knownPackaging:kind.known});
  }
  for(const line of lines){
   const code=knownCodeIn(line),ref=packagingReference(code);
   if(!ref)continue;
   const extracted=productFromLine(line,true);
   const valid=extracted&&(extracted.sku===code||knownCodeIn(extracted.name)===code||fold(line).includes(fold(ref.name).slice(0,12)));
   packagingCandidates.push({name:ref.name,sku:code,kind:ref.type,knownPackaging:true,
    rawAmount:valid?extracted.rawAmount:null,unit:valid?extracted.unit:'unknown',
    cartons:null,pallets:0,review:true,source:'metin-kod'});
  }
  const packagingMap=new Map();
  const quality=r=>(r.rawAmount!=null?8:0)+(r.unit!=='unknown'?4:0)+(r.source==='tablo-konumu'?2:0);
  for(const row of packagingCandidates){
   const key=row.sku&&packagingReference(row.sku)?'CODE:'+row.sku:'NAME:'+signature(row.name);
   if(!packagingMap.has(key)){packagingMap.set(key,{...row,conflict:false});continue}
   const previous=packagingMap.get(key);
   const best=quality(row)>quality(previous)?row:previous;
   const a=previous.rawAmount,b=row.rawAmount;
   const conflict=previous.conflict||(a!=null&&b!=null&&a!==b);
   packagingMap.set(key,{...best,rawAmount:conflict?null:(best.rawAmount??previous.rawAmount??null),
    unit:best.unit==='unknown'?previous.unit:best.unit,conflict,review:conflict||best.review});
  }
  const packagingRows=[...packagingMap.values()];
  const hints=Array.isArray(options.packagingQuantityHints)?options.packagingQuantityHints:[];
  for(const row of packagingRows){
   if(row.conflict)continue;
   const matches=hints.filter(h=>h&&String(h.code||'')===String(row.sku||'')&&Number.isSafeInteger(h.amount)&&h.amount>0);
   const amounts=[...new Set(matches.map(h=>h.amount))];
   if(amounts.length>1){
    // İki odak modu farklı değer okuduysa güvenli bir seçim yapılamaz.
    row.conflict=true;row.rawAmount=null;row.unit='unknown';row.review=true;continue;
   }
   if(amounts.length===1){
    const focused=amounts[0];
    // İki bağımsız odak modu aynı hücrede birleşiyorsa, tek geçişli
    // belge OCR'ından farklı değer üretmiş olsa bile hücreyi esas al.
    // Bu 15 -> 5 kaybında düzeltme sağlar; rastgele 1 eklemez.
    const independent=new Set(matches.filter(h=>h.amount===focused).map(h=>h.source||'belirsiz'));
    const corroborated=independent.has('satır')&&independent.has('blok');
    if(row.rawAmount!=null&&row.rawAmount!==focused&&!corroborated){
     row.conflict=true;row.rawAmount=null;row.unit='unknown';row.review=true;continue;
    }
    row.rawAmount=focused;row.unit=matches.find(h=>h.amount===focused)?.unit||row.unit;
    row.review=true;
   }
  }
  const legacy=Array.isArray(options.depotPalletCandidates)?options.depotPalletCandidates.filter(n=>Number.isSafeInteger(n)&&n>0):[];
  if(packagingRows.length===1&&packagingRows[0].kind==='palet'&&packagingRows[0].rawAmount==null&&!packagingRows[0].conflict&&legacy.length===1){
   packagingRows[0].rawAmount=legacy[0];packagingRows[0].unit='adet';
  }
  const goods=merged.filter(r=>!packagingKind(r));
  const depotItems=packagingRows.filter(r=>r.kind==='palet');
  const depotPallets=depotItems.length===1?depotItems[0].rawAmount:null;
  const depotPalletType=depotItems.length===1?depotItems[0].name:'';
  // Genel palet sayısı, tek ürün olsa bile otomatik ürün paleti değildir.
  const confidence={supplier:supplier.score>=12?'yüksek':supplier.score>=6?'orta':'düşük',invoice:invoice.score>=12?'yüksek':invoice.score>=7?'orta':'düşük',plate:plate.score>=20&&!plate.ambiguous&&!plate.repaired?'yüksek':plate.score>=8?'orta':'düşük',pallets:pal.score>=10&&!pal.ambiguous?'yüksek':pal.score>=5?'orta':'düşük'};
  const notes=[!invoice.value?'İrsaliye numarası bulunamadı.':null,!supplier.value?'Gönderen firma bulunamadı.':null,!plate.value?'Araç plakası bulunamadı.':null,plate.ambiguous?'Birden fazla plaka adayı bulundu.':null,plate.hint?'Plaka metni şüpheli okundu ('+plate.hint+'); lütfen fotoğraftan kontrol edin.':null,pal.value===null?'Sevkiyatın toplam taşıma palet sayısı belirtilmemiş olabilir; boş bırakın.':null,goods.some(x=>['adet','paket','palet'].includes(x.unit))?'Koli dışındaki ürün birimlerini doğrudan koliye çevirmeyin; kayıt öncesi koli karşılığını doğrulayın.':null,goods.some(x=>x.review)?'Bazı ürün satırlarında miktar/birim doğrulaması gerekiyor.':null,packagingRows.some(x=>x.conflict)?'Aynı palet/kasa koduna farklı miktarlar okundu; belgeyi kontrol edin.':null,packagingRows.some(x=>x.rawAmount==null)?'Palet/kasa miktarları eksik olabilir; gözle doğrulayın.':null].filter(Boolean);
  return {supplier:supplier.value,invoice:invoice.value,plate:plate.value,trailerPlate:plate.trailer,plateCandidates:plate.candidates,plateHint:plate.hint,totalPallets:pal.value,depotPallets,depotPalletType,depotPalletRows:depotItems,packagingRows,confidence,rows:goods,notes,raw:String(raw||'')};
 }
 const api={parse,parseTableTSV,findDepotCell,findPackagingCells,findInvoiceCell,readFocusedDepotQuantity,readFocusedPackagingQuantity,productFromLine,linesOf,PACKAGING_REFERENCE,packagingKind};root.AKTIVA_WAYBILL_PARSE=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
