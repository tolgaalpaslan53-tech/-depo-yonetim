/* AKTIVA / İrsaliye ayrıştırıcı V5.
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
 const heading=x=>/^(?:SIRA(?:\s+NO)?|MAL\s*$|MALZEME(?:\s+(?:KODU|TANIMI))?|ÜRÜN(?:\s+(?:ADI|KODU))?|STOK\s+KODU|KALEM|BIRIM|MIKTAR|TOPLAM|VERGI|IRSALIYE|BELGE\s+NO|TARIH|SAYFA|VKN|ETTN|TCKN|ARAC\s+PLAKA|ACIKLAMALAR|TASIYICI|TELEFON|ADRES)/.test(fold(x));
 const footer=x=>/^(?:TASIYICI\s+BILGILERI|ACIKLAMALAR|TESLIM\s+ALAN|GENEL\s+TOPLAM|ODENECEK|TOPLAM\s+(?:KDV|TUTAR)|BANKA|KREDI\s+KARTI)/.test(fold(x));
 function invoiceFrom(lines){
  const label=/(?:E\s*-?\s*)?(?:SEVK\s+)?IRSALIYE\s*(?:NO|NUMARASI|NUM|#)?|BELGE\s*(?:NUMARASI|NO|#)|DOKUMAN\s*NO/;
  const code=/\b[A-Z]{2,4}[0O]?20\d{2}[0-9OIS]{7,12}\b/;
  const ignore=/(?:ETTN|UUID|VKN|TCKN|PLAKA|SAP\s*BELGE|MUSTERI\s*NO|TELEFON|IBAN)/;
  let opts=[];
  lines.forEach((line,i)=>{
   const u=fold(line),m=u.match(code),hasLabel=label.test(u);
   if(!hasLabel&&ignore.test(u))return;
   if(m)opts.push({value:m[0],score:hasLabel?15:8,index:i});
   if(hasLabel){
    const pos=u.search(label);const tail=clean(u.slice(pos+u.slice(pos).match(label)[0].length).replace(/^[\s:#=.-]+/,''));
    for(const [value,weight] of [[tail,12],[fold(lines[i+1]||''),6]]){
     if(!value||ignore.test(value)||/^(?:TARIH|ZAMANI|TIPI|SENARYO|SEVK)$/i.test(value))continue;
     const exact=value.match(code);if(exact)opts.push({value:exact[0],score:weight+3,index:i});
     else{const token=value.match(/\b[A-Z0-9][A-Z0-9/-]{7,29}\b/);if(token&&/[A-Z]/.test(token[0])&&/\d/.test(token[0]))opts.push({value:token[0],score:weight-2,index:i});}
    }
   }
  });
  opts.sort((a,b)=>b.score-a.score||a.index-b.index);return opts[0]||{value:'',score:0};
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
  const explicit=[...s.matchAll(/(\d{1,6}(?:[.,]\d{3})?(?:,0+)?)\s*(?:\||;)?\s*(KOL[Iİ]|KOL\.?|KT|ADET|AD|PALET|PALLET|PLT|PAKET)\b/gi)];
  if(explicit.length){const hit=explicit.find(x=>/KOL[Iİ]|KT/i.test(x[2]))||explicit[explicit.length-1];rawAmount=qty(hit[1]);unit=/KOL[Iİ]|KT/i.test(hit[2])?'koli':/PALET|PLT/i.test(hit[2])?'palet':'adet';core=clean(s.slice(0,hit.index));}
  else if(inTable){const m=s.match(/^(.*?)\s+(\d{1,6}(?:[.,]\d{3})?)(?:\s+\d{1,6}(?:[.,]\d{3})?){0,2}\s*$/);if(m){core=m[1];rawAmount=qty(m[2]);unit='unknown';}}
  if(rawAmount===null||rawAmount===0)return null;
  // Ürün adının sonundan K. İçi / K. Ad / Toplam numeric hücrelerini kaldır.
  core=core.replace(/(?:\s+[\d.,]+){1,4}\s*$/,'').replace(/^\s*\d{1,3}\s+(?=\d{5,14}\b)/,'');
  const match=core.match(/^(?:\d{1,3}\s*[|;.\-]?\s+)?(\d{5,14}|[A-Z]{1,4}[-/]\d{4,14})\s+(.+)$/i);
  if(match){code=match[1];core=match[2];}
  core=clean(core.replace(/^\d{1,3}(?:[.)-])?\s+(?=[A-Za-zÇĞİÖŞÜçğıöşü])/, '').replace(/^[|;\s]+|[|;\s]+$/g,''));
  const title=fold(core);
  if(core.length<4||core.length>200||!/[a-zA-ZçğıöşüÇĞİÖŞÜ]{2}/.test(core)||heading(core)||/^(?:K\.?\s*(?:ICI|AD)|BIRIM|TOPLAM|MIKTAR|SIRA\s*NO|BELGE)/.test(title))return null;
  const pm=s.match(/\b(\d{1,5})\s*(?:PALET|PALLET|PLT)\b/i);if(pm&&unit!=='palet')pallets=Number(pm[1]);
  return {name:core,sku:code,cartons:unit==='koli'?rawAmount:null,rawAmount,unit,pallets,review:unit!=='koli'||!inTable};
 }
 function parse(raw){
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
  // Euro palet satırı ürün kolisi değildir. Kullanıcının işlemi açısından
  // 'depoda kalan palet' olarak ayrı göster; sevkiyat palet toplamına ekleme.
  const palletPattern=/(?:\bPALET\b|\bPALLET\b|\bTURPAL\b|\bPALEX\b)/;
  const depotItems=rows.filter(r=>r.unit==='adet'&&palletPattern.test(fold(r.name))&&Number.isSafeInteger(r.rawAmount)&&r.rawAmount>0);
  const depotPallets=depotItems.length===1?depotItems[0].rawAmount:null;
  const goods=rows.filter(r=>!depotItems.includes(r));
  if(goods.length===1&&pal.value!==null&&goods[0].pallets===0){goods[0].pallets=pal.value;goods[0].review=true}
  const confidence={supplier:supplier.score>=12?'yüksek':supplier.score>=6?'orta':'düşük',invoice:invoice.score>=12?'yüksek':invoice.score>=7?'orta':'düşük',plate:plate.score>=20&&!plate.ambiguous&&!plate.repaired?'yüksek':plate.score>=8?'orta':'düşük',pallets:pal.score>=10&&!pal.ambiguous?'yüksek':pal.score>=5?'orta':'düşük'};
  const notes=[!invoice.value?'İrsaliye numarası bulunamadı.':null,!supplier.value?'Gönderen firma bulunamadı.':null,!plate.value?'Araç plakası bulunamadı.':null,plate.ambiguous?'Birden fazla plaka adayı bulundu.':null,plate.hint?'Plaka metni şüpheli okundu ('+plate.hint+'); lütfen fotoğraftan kontrol edin.':null,pal.value===null?'Sevkiyatın toplam taşıma palet sayısı belirtilmemiş olabilir; boş bırakın.':null,goods.some(x=>x.unit==='adet')?'Adet cinsinden okunan ürünleri koli olarak kaydetmeden önce karşılığını kontrol edin.':null,goods.some(x=>x.review)?'Bazı ürün satırlarında miktar/birim doğrulaması gerekiyor.':null].filter(Boolean);
  return {supplier:supplier.value,invoice:invoice.value,plate:plate.value,trailerPlate:plate.trailer,plateCandidates:plate.candidates,plateHint:plate.hint,totalPallets:pal.value,depotPallets,depotPalletRows:depotItems,confidence,rows:goods,notes,raw:String(raw||'')};
 }
 const api={parse,productFromLine,linesOf};root.AKTIVA_WAYBILL_PARSE=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
