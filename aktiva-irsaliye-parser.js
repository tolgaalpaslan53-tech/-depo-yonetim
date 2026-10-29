/* AKTIVA: Ir­saliye metninden konumdan bagimsiz alan ve olasi urun satiri okuma.
 * Veriyi ASLA otomatik kaydetmez; OCR sonucu kullanici tarafindan duzeltilir.
 * Cikti: {supplier,invoice,rows,notes}; miktar birimi belirsizse cartons bos kalir.
 */
(function(root){'use strict';
 const upper=v=>String(v||'').toLocaleUpperCase('tr-TR');
 const clean=v=>String(v||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 const alnum=s=>upper(s).replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,'');
 function linesOf(raw){return String(raw||'').split(/\r?\n/).map(clean).filter(Boolean)}
 function isHeader(line){return /^(?:SIRA|KALEM|NO\.?|STOK\s+KODU|ÜRÜN\s+KODU|MAL\s*\/\s*HİZMET|MALZEME|ÜRÜN\s+ADI|AÇIKLAMA|MIKTAR|MİKTAR|KOLİ|KOLI|BİRİM|BIRIM|ADET|SAYFA|TOPLAM|GENEL\s+TOPLAM|ARA\s+TOPLAM|KDV|İSKONTO|ISKONTO|TUTAR|FİYAT|FIYAT|BİRİM\s+FİYAT|VERGİ|VERGI|VKN|TCKN|IBAN|TEL|TELEFON|ADRES|SEVK\s+ADRESİ|TESLİM|SİPARİŞ|SIPARIS|ETTN|UUID|BELGE\s+NO|İRSALİYE\s+NO|IRSALIYE\s+NO|E-İRSALİYE\s+NO|E-IRSALIYE\s+NO|DÜZENLENME|TARİH)/i.test(line)}
 function junk(line){return /(?:\b(?:TOPLAM|KDV|ÖDENECEK|TUTAR|ISKONTO|İSKONTO|VERGI|VERGİ|ETTN|SAYFA|TELEFON|IBAN|BANKA|PLAKA|VERGİ\s+DAİRESİ|MAIL|E-POSTA|E-İR[SŞ]ALİYE|IRSALIYE|İRSALİYE|SATIR\s+TOPLAMI)\b)/i.test(line) && !/^(?!.*MALZEME)\S.*\d+\s*(?:KOLİ|KOLI|KT)\b/i.test(line)}
 function invoiceFrom(ls){
  const labels=/(?:E\s*[- ]?\s*)?(?:SEVK\s*)?İ?RSAL[İI]YE\s*(?:NUMARASI|NO\.?|NUM\.?|#)|BELGE\s*(?:NUMARASI|NO\.?|#)|DOK[ÜU]MAN\s*NO\.?/i;
  const exact=/\b[A-ZÇĞİÖŞÜ]{2,5}\s*[- ]?\s*20\d{2}\s*[- ]?\s*\d{7,12}\b/i;
  const reject=/(?:ETTN|UUID|VKN|TCKN|SİPARİŞ|SIPARIS|TELEFON|IBAN|VERGI|VERGİ|PLAKA)/i;
  let opts=[];
  ls.forEach((s,i)=>{
   if(reject.test(upper(s))&&!labels.test(upper(s)))return;
   const full=upper(s), m=full.match(exact);if(m)opts.push({value:clean(m[0]).replace(/\s/g,''),score:labels.test(full)?10:7,index:i});
   if(labels.test(full)){
    const found=full.match(labels);const tail=s.slice(found.index+found[0].length).replace(/^[\s:：#\-.]+/,'');
    const a=[tail,ls[i+1]||''];a.forEach((s2,k)=>{
     let mt=upper(s2).match(/\b[A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9\-/]{5,34}\b/);
     if(mt && !reject.test(mt[0])&&!/^20\d{2}[./-]\d\d/.test(mt[0]))opts.push({value:mt[0],score:k===0?9:6,index:i});
    });
   }
  });
  opts=opts.filter(x=>x.value.length<36).sort((a,b)=>b.score-a.score||a.index-b.index);
  return opts[0]||{value:'',score:0};
 }
 function supplierFrom(ls){
  const key=/(?:GÖNDEREN\s+FİRMA|GÖNDEREN|GONDEREN|SATICI\s+FİRMA|SATICI|SEVK\s+EDEN|TEDARİKÇİ|TEDARIKCI|FİRMA\s+ADI|FIRMA\s+ADI|DÜZENLEYEN|DUZENLEYEN)\s*(?:FİRMA(?:SI)?|ADI|ÜNVANI|UNVANI)?\s*[:：-]?\s*/i;
  const exclude=/(?:ALICI|MÜŞTERİ|MUSTERI|TESLİM\s+ALAN|TESLIM\s+ALAN|SEVK\s+ADRESİ|SEVK\s+ADRESI|ŞUBE|DEPO\s+ADRESİ|DEPO\s+ADRESI)/i;
  const company=/(?:\bA\.?Ş\.?\b|\bLTD\.?\b|\bŞTİ\.?\b|\bSAN\.?\b|\bTİC\.?\b|\bGIDA\b|\bÜRETİM\b)/i;
  let possibilities=[];
  ls.forEach((line,i)=>{
   if(exclude.test(upper(line)))return;
   const m=upper(line).match(key);if(m){
    const value=clean(line.slice(m.index+m[0].length));
    if(value.length>4&&!/^(?:VKN|VERGİ|VERGI|TEL|ADRES|NO|\d{5,})\b/i.test(value))possibilities.push({value,score:10,index:i});
    const next=ls[i+1]||'';
    if(value.length<=4&&next.length>5&&!exclude.test(next)&&!isHeader(next))possibilities.push({value:next,score:8,index:i+1});
   }
   if(i<Math.min(ls.length,14)&&line.length>=9&&line.length<140&&company.test(upper(line))&&!exclude.test(upper(line))&&!/\d{5,}/.test(line))possibilities.push({value:line,score:i<4?7:5,index:i});
  });
  possibilities.sort((a,b)=>b.score-a.score||a.index-b.index);
  let top=possibilities[0]||{value:'',score:0};
  let value=top.value.replace(/^(?:GÖNDEREN|SATICI|FİRMA\s+ADI|TEDARİKÇİ|SEVK\s+EDEN)\s*[:：-]\s*/i,'').trim().slice(0,150);
  return {value,score:top.score};
 }
 function qty(s){const f=String(s||'').replace(/\./g,'').replace(/,/g,'.');if(!/^\d+(?:\.0+)?$/.test(f))return null;const n=Number(f);return Number.isSafeInteger(n)&&n>=0&&n<=999999?n:null}
 function productFromLine(raw,headers){
  let s=clean(raw);if(s.length<8||isHeader(s)||junk(s))return null;
  s=s.replace(/^\s*(?:\d{1,3}[.)]|\d{1,3}\s*[-|])\s+/,'');
  let name='',code='',count=null,unit='unknown',pallets=0;
  // '1 | 12345 | ÜRÜN | 24 | KOLİ' ve tablolardaki çoklu sütunlar
  const parts=s.split(/\t|\s{3,}|\s*[|;]\s*/).map(clean).filter(Boolean);
  let core=s;
  let explicit=[...s.matchAll(/(\d{1,6}(?:[.,]0+)?)\s*[|;]?\s*(KOLİ|KOLI|KOL\.?|KOL\b|KT\b|ADET|AD\b|PKT\b|PAKET|PAL[Eİ]T)\b/gi)];
  if(explicit.length){
   const hit=explicit.find(x=>/KOLİ|KOLI|KOL\.?|KT\b/i.test(x[2]))||explicit[0];
   count=qty(hit[1]);unit=/KOLİ|KOLI|KOL\.?|KT\b/i.test(hit[2])?'koli':/PAL[Eİ]T/i.test(hit[2])?'palet':'adet';
   core=clean(s.slice(0,hit.index)).replace(/[|;\s]+$/, '');
   if(core.length<4){const alt=parts.find(x=>/[a-zçğıöşüA-ZÇĞİÖŞÜ]/.test(x)&&!isHeader(x));if(alt)core=alt}
   const p=s.match(/(\d{1,4})\s*(?:PALET|PAL[Eİ]T)\b/i);if(p)pallets=Number(p[1]);
  }else if(parts.length>=2){
   // Açık bir 'Koli' sütunu bulunmuyorsa miktarı aday olarak tut fakat otomatik koli kabul etme.
   const end=parts.slice(-3).find(x=>qty(x)!==null);
   if(end){count=qty(end);unit=headers?'koli':'unknown';const at=s.lastIndexOf(end);core=clean(s.slice(0,at))}
  }else{
   const m=s.match(/^(.+?)\s+(\d{1,6}(?:[.,]0+)?)\s*$/);
   if(m){core=clean(m[1]);count=qty(m[2]);unit=headers?'koli':'unknown'}
  }
  if(count===null||count===0)return null;
  core=core.replace(/\s+\d{1,3}[,.]\d{2,4}\s*$/,'');
  const cm=core.match(/^([0-9]{5,14}|[A-Z]{1,4}[-/][0-9]{4,14})\s+(.+)$/i);
  if(cm){code=cm[1];core=cm[2]}
  core=clean(core.replace(/^\d{1,3}[.)]\s*/,'').replace(/\b(?:KODU|ÜRN\.)\b\s*$/i,''));
  if(core.length<3||core.length>190||!/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(core)||/^\d+[./-]/.test(core))return null;
  if(/^(?:IR[SŞ]ALİYE|TARİH|TARIH|SAAT|BİRİM|BIRIM|ÜRÜN\s+ADI|URUN\s+ADI|MİKTAR|MIKTAR|SATIR|SIRA|MAL\s*\/\s*HİZMET)/i.test(core))return null;
  return {name:core.slice(0,200),sku:code,cartons:unit==='koli'?count:null,rawAmount:count,unit,pallets:Number.isSafeInteger(pallets)?pallets:0,review:unit!=='koli'};
 }
 function parse(text){
  const ls=linesOf(text),inv=invoiceFrom(ls),sup=supplierFrom(ls);
  let inTable=false,headerHasKoli=false,rows=[],seen=new Set();
  for(let i=0;i<ls.length;i++){
   const s=ls[i];
   if(/(?:ÜRÜN\s+ADI|URUN\s+ADI|MALZEME|MAL\s*\/\s*HİZMET|STOK\s+KODU|MAL\s+HİZMET)/i.test(upper(s))&&/(?:MIKTAR|MİKTAR|KOLİ|KOLI|BİRİM|BIRIM)/i.test(upper(s))){inTable=true;headerHasKoli=/\bKOLİ\b|\bKOLI\b/i.test(upper(s));continue}
   if(/^(?:TOPLAM\s+TUTAR|GENEL\s+TOPLAM|ARA\s+TOPLAM|TOPLAM\s+KDV|ÖDENECEK|İRSALİYE\s+NOTU)/i.test(s)){inTable=false;continue}
   const row=productFromLine(s,inTable&&headerHasKoli);
   if(!row)continue;
   // Belgenin ürün kısmı dışında saptanan satırlar kullanıcı incelemesinde tutulur.
   if(!inTable && row.unit==='unknown')continue;
   const signature=alnum(row.name)+'|'+row.sku+'|'+row.rawAmount;
   if(seen.has(signature))continue;seen.add(signature);
   row.review=row.review||!inTable;rows.push(row);
   if(rows.length>=150)break;
  }
  return {supplier:sup.value,invoice:inv.value,confidence:{supplier:sup.score>=8?'yüksek':sup.score>=5?'orta':'düşük',invoice:inv.score>=8?'yüksek':inv.score>=6?'orta':'düşük'},rows,notes:[!inv.value?'İrsaliye numarası bulunamadı.':null,!sup.value?'Gönderen firma bulunamadı.':null,rows.some(r=>r.review)?'Bazı ürün miktarlarının birimi veya satır eşleşmesi belirsiz.':null].filter(Boolean),raw:String(text||'')};
 }
 const api={parse,productFromLine,linesOf};root.AKTIVA_WAYBILL_PARSE=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
