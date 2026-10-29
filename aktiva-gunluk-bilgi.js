/* AKTİVA - Mal Kabul günlük bilgi kartı. Forklift/push sisteminden bağımsız. */
(()=>{'use strict';
const tips=[
 [
  "GS1 / Barkod",
  "(00) barkodda ne demek?",
  "GS1 lojistik etiketindeki (00), 18 haneli SSCC numarasını belirtir; ürün kodunu değil, fiziksel lojistik birimini tanımlar.",
  "Aynı ürünle dolu iki palet farklı SSCC taşıyabilir. Palet takibinde yalnızca ürün koduna bakmak bu iki paleti ayırt etmeye yetmez."
 ],
 [
  "Mal Kabul",
  "Ön kayıt depo girişi değildir",
  "Araç ön kaydının açılması, aracın fiziksel olarak depoya veya perona alındığı anlamına gelmez. Bu iki zaman ayrı tutulursa bekleme süreleri doğru ölçülür.",
  "Geliş, perona yönlendirme ve çıkış saatlerini ayrı kaydet; tek bir “giriş” saati tüm süreci açıklamaz."
 ],
 [
  "Lot / SKT",
  "FIFO ile FEFO aynı strateji değil",
  "FIFO önce giren ürünü, FEFO ise uygun ürünler arasında tarihi önce dolanı önce çıkarma yaklaşımını ifade eder. İlk gelen ürün her zaman en yakın SKT’li olmayabilir.",
  "Dün gelenin SKT’si 2028, bugün gelenin SKT’si 2027 ise FEFO önceliği bugünkü partiye verebilir."
 ],
 [
  "Kalite / Gıda",
  "Soğutucunun havası ürünün içi değildir",
  "Soğuk zincirde araç içi hava sıcaklığı ile ürünün gerçek sıcaklığı farklı olabilir. Kapının açılması havayı hızla değiştirirken ürün daha yavaş tepki verebilir.",
  "Kabul ölçümünü ürün tipine ve şirket prosedürüne uygun ekipman, ölçüm noktası ve yöntemle yap."
 ],
 [
  "Palet / Güvenlik",
  "Palet ölçüsü kapasiteyi söylemez",
  "120×80 cm bir palet ile başka bir 120×80 cm paletin taşıma kapasitesi aynı olmak zorunda değildir; malzeme, tasarım ve kullanım durumu değişebilir.",
  "Yük sınırını boyuttan tahmin etme; üretici ve işletme güvenlik kurallarına göre değerlendir."
 ],
 [
  "WMS / Operasyon",
  "Stok var, neden sevk edilemiyor?",
  "Toplam stok; karantinada, rezervde, bloke veya hasarlı stokları da kapsayabilir. Kullanılabilir stok daha düşük olabilir.",
  "Örnek: 100 koli toplam, 15 bloke, 20 rezerv ise serbest stok en fazla 65 koli olabilir."
 ],
 [
  "Veri / Rapor",
  "A4 Excel raporunda sayı biçimi sürprizi",
  "Excel uzun barkodları sayı olarak yorumlayıp son basamakları değiştirebilir veya bilimsel gösterime çevirebilir.",
  "Barkod, plaka, irsaliye ve lot alanlarını metin biçiminde dışa aktar; baştaki sıfırları koru."
 ],
 [
  "GS1 / Barkod",
  "(01) ürünün kimliği",
  "GS1 barkodunda (01) alanı 14 haneli GTIN ürün kimliğini taşır. Tek başına lotu, son kullanma tarihini veya o kolinin adedini söylemez.",
  "Ürün doğrularken GTIN ile lot ve tarih alanlarını birbirine karıştırma; her veri ayrı amaçla tutulur."
 ],
 [
  "Mal Kabul",
  "İrsaliyedeki 100 koli, kabulde 100 koli demek değil",
  "İrsaliye tedarikçinin beyanıdır. Fiziksel teslim alınan, hasarlı ve reddedilen miktar ayrı kaydedilmeden gerçek kabul sayısı anlaşılmaz.",
  "100 beyan, 98 sağlam, 2 hasarlı teslimatta üç değeri ayrı göster; ikisini gizleyerek 100 kabul yazma."
 ],
 [
  "Lot / SKT",
  "Tek GTIN, birden fazla lot",
  "Aynı stok kodundaki 20 koli iki üretim partisinden gelmişse geri çağırma yalnızca bir partiyi etkileyebilir.",
  "20 koliyi tek lotmuş gibi kaydetmek, sorun çıktığında ayırmayı güçleştirir."
 ],
 [
  "Kalite / Gıda",
  "Bir anlık doğru sıcaklık yeterli mi?",
  "Teslim anında uygun görünen sıcaklık, ürünün tüm taşıma süresince uygun koşullarda kaldığını tek başına kanıtlamaz.",
  "Gerektiğinde sıcaklık kayıt cihazı veya taşıma kayıtlarıyla süreç boyunca koşulları doğrula."
 ],
 [
  "Palet / Güvenlik",
  "Streç film yapısal sağlamlık yerine geçmez",
  "Çok kat streç sarılmış bir palet, kırık tahta veya bozuk yük merkezi sorununu ortadan kaldırmaz.",
  "Yük dengesi, palet bütünlüğü ve yük sabitlemesini ayrı ayrı kontrol et."
 ],
 [
  "WMS / Operasyon",
  "Gerçek stok farkı bazen lokasyon farkıdır",
  "Ürün sistemde yanlış raf/alan konumunda görünüyorsa depo toplamı doğru olsa da personel ürünü bulamaz.",
  "Sayım farkında sadece toplam adede değil lokasyon ve hareket geçmişine bak."
 ],
 [
  "Veri / Rapor",
  "Koli farkı ile yüzde farkı farklı bakış verir",
  "5 koli eksik, beklenen 10 kolide %50; beklenen 1.000 kolide %0,5 eksiktir. Aynı 5 koli farklı operasyonel öneme sahip olabilir.",
  "Raporlarda eksik/fazlayı hem miktar hem oran olarak incele."
 ],
 [
  "GS1 / Barkod",
  "(02) ve (37) birlikte okunur",
  "Lojistik etikette (02), içerideki ticari ürünün GTIN’ini; (37), o üründen kaç birim olduğunu belirtir. Bunlar birbiriyle ilişkili alanlardır.",
  "Bir paletin (37) alanını okuyunca bunun koli mi adet mi olduğunu ilgili GTIN’in ambalaj seviyesinden doğrula."
 ],
 [
  "Mal Kabul",
  "Sipariş – irsaliye – fiziksel ürün üçgeni",
  "Sipariş neyin beklendiğini, irsaliye neyin gönderildiğinin beyanını, fiziksel sayım ise neyin geldiğini gösterir. Üçü aynı kaynak değildir.",
  "Üçlü uyuşmazlıkta yalnızca irsaliyeyi “doğru” kabul ederek sistem stoğunu değiştirme."
 ],
 [
  "Lot / SKT",
  "Parti geri çağırmada asıl filtre olabilir",
  "Gıda geri çağırmalarında bazen bütün ürün değil, belirli üretim lotları etkilenir.",
  "Ürün adı tek başına yeterli değildir; lot, SKT, tedarikçi ve hareket kayıtları birlikte tutulmalı."
 ],
 [
  "Kalite / Gıda",
  "Ambalaj üstündeki su her zaman sızıntı değil",
  "Soğuk yüzey sıcak, nemli havaya çıkınca yoğuşma oluşabilir. Ancak yoğuşma ile gerçek ambalaj sızıntısı karıştırılmamalıdır.",
  "Islak koli gördüğünde yalnızca “terleme” deyip geçme; ambalaj bütünlüğü ve ürün koşullarını kontrol et."
 ],
 [
  "Palet / Güvenlik",
  "Yük merkezi kayınca palet davranışı değişir",
  "Paletin bir kenarına yığılan koliler, kaldırma ve hareket sırasında dengesizlik riskini artırır.",
  "Ağır kolilerin yerleşimini ve ağırlık dağılımını kontrol et; uygunsuz yükleri yeniden düzenlettir."
 ],
 [
  "WMS / Operasyon",
  "Çevrim sayımı depoyu durdurmadan yapılabilir",
  "Cycle counting, seçili ürün veya lokasyonların periyodik sayımıdır; tüm depoyu tek seferde kapatarak sayım yapmayı gerektirmez.",
  "Yüksek hareketli ve sorunlu ürünlere daha sık sayım uygulamak operasyonel olarak mantıklı olabilir."
 ],
 [
  "Veri / Rapor",
  "“Geçen hafta” hangi haftadır?",
  "Haftalık raporlar takvim haftası, son 7 gün veya operasyon haftası olarak hesaplanabilir; sonuçlar farklı çıkar.",
  "Rapor başlığında başlangıç ve bitiş tarihlerini görünür tut; varsayılan dönemi açık belirt."
 ],
 [
  "GS1 / Barkod",
  "(10) aslında lot numarası",
  "GS1 barkodundaki (10) üretim partisi/lot numarasını gösterir. Ürünün aynı GTIN’i farklı lotlarla gelebilir.",
  "Aynı ürün koduna sahip kolileri sayarken farklı lotları karıştırma; geri çağırmada belirleyici olan lot olabilir."
 ],
 [
  "Mal Kabul",
  "Aynı ürün iki satırda olabilir",
  "Tek irsaliyede aynı stok kodu farklı lot, SKT veya ambalaj birimi nedeniyle birden fazla satırda bulunabilir. Satırları körlemesine birleştirmek izlenebilirliği bozar.",
  "Toplam koli doğru görünse de lot veya SKT kaybı olup olmadığını kontrol et."
 ],
 [
  "Lot / SKT",
  "SKT ile TETT aynı şey değil",
  "Son tüketim tarihi ile tavsiye edilen tüketim tarihi farklı anlamlara gelir; hangi ifadenin kullanılacağı ürün ve mevzuata göre değişir.",
  "TETT’yi otomatik “SKT geçti” uyarısına dönüştürmeden önce tarih türünü doğru sınıflandır."
 ],
 [
  "Kalite / Gıda",
  "Koku, görünüş ve tarih tek başına yeterli değil",
  "Bazı gıda riskleri ambalajın dışından görünmeyebilir ve koku yaratmayabilir.",
  "Şüpheli ürünün uygunluğunu sadece koklayarak belirlemeye çalışma; izlenebilirlik ve kalite prosedürünü uygula."
 ],
 [
  "Palet / Güvenlik",
  "Palet etiketi yükün doğruluğunu kanıtlamaz",
  "Bir paletin etiketinde 60 koli yazması, fiziksel olarak 60 koli bulunduğunu tek başına kanıtlamaz.",
  "Özellikle parçalanmış veya yeniden streçlenmiş paletlerde etiket sayısını fiziksel sayımla doğrula."
 ],
 [
  "WMS / Operasyon",
  "ABC analizi neden tek başına yeterli olmayabilir?",
  "ABC stok sınıflaması değer veya hareket gibi bir ölçüte göre önceliklendirir; düşük değerli ama kritik ürünün önemi gözden kaçabilir.",
  "Kritiklik ve raf ömrü gibi ek ölçütlerle kontrol sıklığını belirle."
 ],
 [
  "Veri / Rapor",
  "Tarih aralığında bitiş saati tuzağı",
  "“1–10 Ekim” raporu 10 Ekim saat 00.00’da biterse son günün işlemleri rapora girmez.",
  "Teknik olarak başlangıç dâhil, ertesi gün başlangıcı hariç zaman aralığı kullanmak günün tamamını kapsar."
 ],
 [
  "GS1 / Barkod",
  "(15) ile (17) aynı tarih değil",
  "GS1’de (15) tavsiye edilen tüketim/kalite tarihi (best before); (17) ise son kullanma/expiry tarihidir. İkisinin anlamı farklıdır.",
  "Sistem tarih alanı seçimini rastgele yapma; ürün etiketindeki tarih türünü işletme prosedürüne göre eşleştir."
 ],
 [
  "Mal Kabul",
  "Bir koli farkın kaynağı birim dönüşümü olabilir",
  "10 koli × 12 adet = 120 adettir. Ama ürün kartı 10’lu ambalaj tanımlıyorsa 100 görünür; sayı farkı fiziksel eksikten değil karttan kaynaklanabilir.",
  "Miktar uyuşmazlığında önce “koli içi adet” ve sayım biriminin doğru tanımlandığını kontrol et."
 ],
 [
  "Lot / SKT",
  "Kısa tarihli parti otomatik kabul edilmez",
  "SKT’si yakın ürün, daha sevk edilmeden mağazada raf ömrünü tüketebilir. Kabul kararı sadece “henüz tarih geçmedi” ölçütüne dayanmaz.",
  "Tedarikçi anlaşmasındaki minimum kalan raf ömrü koşullarına göre istisna kaydı oluştur."
 ],
 [
  "Kalite / Gıda",
  "Şişmiş ambalaj önemli bir işarettir",
  "Normalde şişkin olmaması gereken kapalı ambalajdaki beklenmedik şişme, ürün veya paketleme sorunu gösterebilir.",
  "Normal ambalaj şekliyle karşılaştır; şüpheli ürünü onay gelmeden kabul/dağıtıma açma."
 ],
 [
  "Palet / Güvenlik",
  "Palet değişimi izlenebilirliği koparabilir",
  "Ürünler kırık paletten yeni palete aktarılınca eski palet etiketinin yeni yüke aynen taşınması her zaman doğru olmayabilir.",
  "Yeni lojistik birim kimliği gerekip gerekmediğini işletmenin SSCC/etiket sürecine göre kontrol et."
 ],
 [
  "WMS / Operasyon",
  "Hata oranı ve hata adedi farklıdır",
  "100 sevkiyatta 5 hata %5; 1.000 sevkiyatta 20 hata %2 oranına karşılık gelir. Sadece hata sayısına bakmak performansı yanlış yansıtabilir.",
  "Raporlarken hatayı ilgili toplam işlem veya koli miktarına oranla."
 ],
 [
  "Veri / Rapor",
  "UTC ve Türkiye saati aynı değil",
  "Veritabanında UTC tutulan işlem saati yerel ekranda Türkiye saatine çevrilir; dönüşüm yanlışsa rapor işlemi yanlış güne yazabilir.",
  "Günlük rapor sınırlarını uygulamanın işletme saat dilimine göre oluştur."
 ],
 [
  "GS1 / Barkod",
  "(11) ve (13) ne söyler?",
  "GS1 uygulama tanımlayıcılarında (11) üretim tarihini, (13) ambalajlama tarihini ifade eder; ikisi son kullanma tarihi değildir.",
  "Bir tarihin 6 haneli olması onu otomatik SKT yapmaz. Önündeki AI kodunu da oku."
 ],
 [
  "Mal Kabul",
  "Kabul miktarıyla hasarı iki kez düşme",
  "Sistemde “sayılan toplam” ve “hasarlı” ayrı alanlarsa, hasarı toplamdan ikinci kez düşmek miktarı yanlış azaltabilir.",
  "Örnek: 100 gelenin 3’ü hasarlıysa alanların toplam mı sağlam mı istediğini öğren; aynı 3 koliyi iki kere eksiltme."
 ],
 [
  "Lot / SKT",
  "İki tarih birbiriyle çelişirse?",
  "Koli etiketiyle iç ürün ambalajında farklı lot veya tarih varsa doğru olanı tahmin etmek izlenebilirlik hatasına yol açabilir.",
  "Uyuşmayan koliyi şirket prosedürüne göre ayırıp kalite birimine danış."
 ],
 [
  "Kalite / Gıda",
  "Kırık dış koli ve sağlam iç ürün farklı kararlardır",
  "Dış kolinin ezilmesi her zaman iç ürünün bozulduğu anlamına gelmez; ama otomatik sağlam kabul de edilemez.",
  "Hasarın düzeyini fotoğraflayıp ürün güvenliği ve sevke uygunluk kararını prosedüre göre ver."
 ],
 [
  "Palet / Güvenlik",
  "Kamyon hareketi boşaltmada ciddi risktir",
  "Boşaltma sırasında araç veya dorse kontrolsüz hareket ederse rampa ile araç arasında tehlikeli boşluk oluşabilir.",
  "Araç sabitleme, rampa ekipmanı ve giriş izni için işletmenin güvenlik prosedürünü uygula."
 ],
 [
  "WMS / Operasyon",
  "Ortalama bekleme bazen gerçeği saklar",
  "Çoğu araç 20 dakikada içeri alınıp bir araç 5 saat bekliyorsa yalnızca ortalama, aşırı geciken aracı görünmez kılabilir.",
  "Ortalama yanında en uzun beklemeyi veya 90. yüzdelik bekleme süresini de izle."
 ],
 [
  "Veri / Rapor",
  "Bir işlemde iki farklı zaman olabilir",
  "“Araç 07.45’te geldi” olayı ile “personel 08.10’da sisteme girdi” zamanı aynı değildir.",
  "Gerçek olay saati ve kayıt oluşturulma saati ayrılırsa gecikmiş veri girişi tespit edilebilir."
 ],
 [
  "GS1 / Barkod",
  "Barkodda 6 haneli tarih şifresi",
  "GS1 tarih alanlarında YYMMDD biçimi kullanılır. Örneğin 270615, ilgili alandaki kodun anlamına göre 15 Haziran 2027 tarihidir.",
  "Ön ek (11), (15) veya (17) okunmadan sadece 270615 sayısına bakıp tarih türü belirlenmez."
 ],
 [
  "Mal Kabul",
  "Fazla gelen ürün otomatik kazanım değildir",
  "Beklenenden fazla gelen koli, doğru ürün olsa bile sipariş, depolama ve fatura uyuşmazlığı yaratabilir.",
  "Sipariş üstü fazlalığı ayrı fark olarak kaydet; stok kabulüne alma kararını yetkili prosedürüne bırak."
 ],
 [
  "Lot / SKT",
  "Lot karışımı görünmez risk yaratır",
  "Aynı paletin ortasında farklı SKT’li koliler varsa sadece en üst koliyi okuyarak paletin tamamını tek tarihe bağlamak hatalıdır.",
  "Karışık paletlerde örnekleme planını ve lot ayrıştırma kuralını işletme prosedürüne göre uygula."
 ],
 [
  "Kalite / Gıda",
  "Çapraz bulaşma sadece gıdalar arasında olmaz",
  "Dökülen temizlik kimyasalı, hasarlı gıda ambalajlarının bulunduğu alanda ayrı bir risk oluşturabilir.",
  "Gıda ve kimyasal ürünlerin yerleşim ayrımını, taşıma ve sızıntı prosedürlerini kontrol et."
 ],
 [
  "Palet / Güvenlik",
  "Forklift ile yaya aynı anda dar alanda olmamalı",
  "Forklift operatörü yük nedeniyle önünü kısmen göremeyebilir; kör noktalar yaya için risk oluşturur.",
  "Mal kabul sayımı için forklift güzergâhına gelişigüzel girme; ayrılmış yaya yollarını kullan."
 ],
 [
  "WMS / Operasyon",
  "Bir araç iki farklı kuyruk yaşayabilir",
  "Depo dışı bekleme ve perona alındıktan sonraki boşaltma beklemesi ayrı darboğazlardır.",
  "Saatleri ayrı tutarsan kapı planlama mı yoksa rampa operasyonu mu yavaş, anlaşılır."
 ],
 [
  "Veri / Rapor",
  "Veri temizliği, silme demek değil",
  "Yanlış plakanın düzeltilmesi gerekiyorsa orijinal girişin izini korumak denetim ve sorun çözmede önemlidir.",
  "Düzeltme geçmişi ve düzeltme nedeni, özellikle irsaliye/şoför/lot değişimlerinde işe yarar."
 ],
 [
  "GS1 / Barkod",
  "3102 rakamı ağırlık söyleyebilir",
  "GS1’de 310n ailesi kilogram cinsinden net ağırlık bilgisidir. Son rakam n, altı haneli değerdeki ondalık basamak sayısını gösterir.",
  "Örneğin (3102)001250, ilgili GS1 bağlamında 12,50 kg net ağırlık demektir; 1.250 kg değildir."
 ],
 [
  "Mal Kabul",
  "Yanlış stok kodu en tehlikeli sessiz hatalardan",
  "Sayılan miktar doğru olsa bile 500 ml ve 1 L ürünlerin kodları karışırsa sistemde iki üründe birden stok farkı oluşur.",
  "Benzer ambalajlı ürünlerde sadece marka ve fotoğrafla değil ürünün tam varyantıyla doğrulama yap."
 ],
 [
  "Lot / SKT",
  "Üretim tarihi raf ömrü değildir",
  "Üretim tarihini bilmek ürünün ne kadar süre güvenli/uygun kalacağını tek başına belirlemez; bu süre ürün ve saklama koşullarına bağlıdır.",
  "Üretim tarihini SKT yerine girme; ürün etiketindeki tarih açıklamasını kontrol et."
 ],
 [
  "Kalite / Gıda",
  "Sıcaklık alarmının zamanı önemlidir",
  "Kayıt cihazındaki sıcaklık sapmasının kaç derece olduğu kadar, ne kadar sürdüğü de değerlendirmeyi etkileyebilir.",
  "Tek bir ekran fotoğrafına bakarak ürünün güvenli olduğuna karar verme; kayıt geçmişini kalite birimiyle değerlendir."
 ],
 [
  "Palet / Güvenlik",
  "Zemindeki küçük eğim önemli olabilir",
  "Palet yükü eğimli veya bozuk zeminde bekletildiğinde kayma ve dengesizlik riski artabilir.",
  "Geçici bekleme alanını yalnızca boş olduğu için seçme; zemin ve saha kurallarını kontrol et."
 ],
 [
  "WMS / Operasyon",
  "Yoğunluk sayısı ile iş yükü eşit değil",
  "5 araç toplam 50 koli, 1 araç 1.000 koli taşıyabilir. Araç sayısı tek başına mal kabul iş yükünü ölçmez.",
  "Günlük planlamada araç sayısı yanında koli/palet ve ürün satırı sayısını da değerlendir."
 ],
 [
  "Veri / Rapor",
  "Sıfır hata = sıfır risk demek değildir",
  "Hiç eksik/hasarlı kaydı girilmemesi, kusur olmadığı gibi bildirim yapılmadığı anlamına da gelebilir.",
  "Raporları sadece “kaç hata çıktı?” diye değil “kontrol yapıldı mı?” verisiyle yorumla."
 ],
 [
  "GS1 / Barkod",
  "Bir barkod birden fazla veri taşır",
  "GS1-128 ve GS1 DataMatrix; GTIN, lot ve tarih gibi birden fazla alanı tek sembolde taşıyabilir. Her çizgili barkod bunu yapmaz.",
  "Okuyucunun yalnızca ham rakam üretmesi yetmeyebilir; yazılımın uygulama tanımlayıcılarını çözümlemesi gerekir."
 ],
 [
  "Mal Kabul",
  "İptal ile silme aynı şey değil",
  "İptal edilen kaydın nedeni ve zamanı saklanırsa geçmiş işlem incelenebilir. Tamamen silinen kayıtta uyuşmazlığın kökü kaybolabilir.",
  "Yanlış kayıtları düzeltirken geriye dönük denetim ve işlem geçmişini koruyan yöntemi kullan."
 ],
 [
  "Lot / SKT",
  "Karantina stoğu normal stok değildir",
  "Şüpheli veya onay bekleyen mal fiziksel olarak depoda olabilir; ancak sevke uygun sayılmamalıdır.",
  "“Depoda var” ve “kullanılabilir stok” kavramlarını ayrı takip et; beklemedeki ürünü yanlışlıkla sevke çıkarma."
 ],
 [
  "Kalite / Gıda",
  "Donma hasarı yalnızca buz görüldüğünde olmaz",
  "Donmaya hassas bazı ürünler düşük sıcaklıktan zarar görebilir; her ürün için “ne kadar soğuk o kadar iyi” doğru değildir.",
  "Ürün bazında tanımlı kabul ve taşıma sıcaklık aralığını kontrol et."
 ],
 [
  "Palet / Güvenlik",
  "Farklı palet tiplerini sayarken ayır",
  "Ahşap, plastik, kiralık ve firma özel paletleri aynı “palet” toplamına yazmak iade mutabakatını bozabilir.",
  "Palet giriş/çıkış kayıtlarında tip ve firma aidiyetini ayrı tut."
 ],
 [
  "WMS / Operasyon",
  "Aynı kayıt iki kez giderse stok iki kez artabilir",
  "Zayıf bağlantıda kullanıcı işlem tamamlanmadı sanıp tekrar kaydedebilir. Sunucu tekrarları ayırt etmiyorsa çift kabul oluşabilir.",
  "Kaydın başarı durumunu doğrula; uygulamada işlem kimliğiyle mükerrer kayıt önleme önemli bir güvencedir."
 ],
 [
  "Veri / Rapor",
  "Veri kalitesi, tamlıktan fazlasıdır",
  "Her alan dolu olsa bile aynı ürün yanlış kodla girilmişse kayıt eksiksiz ama hatalıdır.",
  "Kaliteyi doğruluk, tamlık, tutarlılık ve zamanında giriş açısından değerlendir."
 ],
 [
  "GS1 / Barkod",
  "Parantezler kodun parçası olmayabilir",
  "GS1 etiketlerinde (01), (10), (17) gibi parantezler insanın okuması içindir. Tarayıcının ham verisinde bu parantezler bulunmayabilir.",
  "Barkod okuyucu çıktısını elle girilen parantezli metinle birebir karşılaştırarak yanlış hata üretme."
 ],
 [
  "Mal Kabul",
  "Fotoğraf tek başına sayım kanıtı değildir",
  "Fotoğraf hasarı veya ambalaj etiketini gösterebilir; ancak tüm paletin miktarını, lotunu ve teslim koşullarını tek başına doğrulamayabilir.",
  "Hasar fotoğrafına ürün kodu, miktar, zaman ve belge referansını bağla."
 ],
 [
  "Lot / SKT",
  "Etiket yenilemek geçmişi değiştirmez",
  "Hasarlı palet etiketi yeniden basıldığında yeni etiketteki ürün, lot ve miktar bilgisi eski fiziksel yükle tutarlı olmalıdır.",
  "Sırf barkod daha temiz görünsün diye bilinmeyen lotu tahmin ederek yeni etiket oluşturma."
 ],
 [
  "Kalite / Gıda",
  "Hasar kayıtlarında kanıt sırası",
  "Fotoğrafta sadece yırtık karton görünürse hangi ürün, hangi palet ve hangi araçla geldiği sonradan belirsiz kalabilir.",
  "Önce genel görünüm, sonra etiket/lot, sonra hasarın yakın fotoğrafını al; bunları aynı kayda iliştir."
 ],
 [
  "Palet / Güvenlik",
  "Palet sayısı ile iade borcu aynı şey olmayabilir",
  "Depodaki boş paletlerin tamamı aynı tedarikçiye veya havuz sistemine ait olmayabilir.",
  "İade takibinde sadece toplam adedi değil kime hangi tip palet borcu olduğunu izle."
 ],
 [
  "WMS / Operasyon",
  "İnternet kesintisinde “kaydedildi” her zaman eşit değil",
  "Çevrimdışı sıraya alınan kayıt cihazda tutulmuş olabilir; merkezi sunucuya henüz ulaşmamış olabilir.",
  "Çevrimiçi olunca senkronizasyonu ve bekleyen kayıt sayısını kontrol et; sıraya alma ile sunucu onayını ayır."
 ],
 [
  "Veri / Rapor",
  "Mükerrer satır neden gizli maliyet yaratır?",
  "Aynı irsaliyeyi iki kere kabul etmek toplam adetleri şişirir; sonraki düzeltme, iade ve mutabakatı karmaşıklaştırır.",
  "Kayıt açmadan önce plaka, firma, irsaliye ve açık işlem eşleşmelerini kontrol et."
 ],
 [
  "GS1 / Barkod",
  "FNC1 neden önemli?",
  "Lot gibi değişken uzunluklu GS1 alanlarından sonra başka bir alan varsa, ayrım için FNC1 veri ayırıcı gerekebilir. Bu bilgi eksikse kod yanlış ayrıştırılabilir.",
  "Tarama sonrası lotun sonuna tarih rakamları yapışıyorsa sorun ürün adında değil, barkod ayrıştırmasında olabilir."
 ],
 [
  "Mal Kabul",
  "Kapıdaki varış saati ve boşaltma başlangıcı",
  "Araç 08.00’de gelip 10.15’te perona alınmışsa 2 saat 15 dakikalık bekleme vardır; boşaltma performansını bu beklemeyle karıştırmak yanlış olur.",
  "Radar ve raporda dışarıda bekleme, peron bekleme ve kabul süresi için farklı başlangıç/bitiş noktaları kullan."
 ],
 [
  "Lot / SKT",
  "Tedarik tarihiyle üretim partisi farklı",
  "Aynı lot farklı günlerde, farklı araçlarla depoya gelebilir. Bir lot tek bir irsaliyeye bağlı olmak zorunda değildir.",
  "Lot bazlı izlenebilirlik için gelen her sevkiyatın lot ilişkisini koru."
 ],
 [
  "Kalite / Gıda",
  "İade ürün doğrudan yeniden satış stoku değildir",
  "Müşteriden veya mağazadan dönen malın depoya ulaşması tek başına yeniden sevke uygun olduğu anlamına gelmez.",
  "İade nedeni, muhafaza koşulu ve kalite kararını orijinal kabulden ayrı kaydet."
 ],
 [
  "Palet / Güvenlik",
  "Geçici bekleme alanı sonsuz kapasite değildir",
  "Kabul öncesi alandaki doluluk arttıkça acil geçiş, sayım düzeni ve yük güvenliği etkilenebilir.",
  "Araçları hızlı almak için güvenli yerleşimi ihmal etme; kapasite aşımını sorumluya bildir."
 ],
 [
  "WMS / Operasyon",
  "Ürün kabuldeyse sevkiyata hazır olmayabilir",
  "Araçtan indirilen koli, sayım, kalite onayı veya doğru lokasyona yerleştirme bitmeden sevk edilebilir stok hâline gelmeyebilir.",
  "Kabul edildi, kontrol edildi ve yerleştirildi durumlarını birbirinin yerine kullanma."
 ],
 [
  "GS1 / Barkod",
  "Son hane hata yakalayabilir",
  "GTIN barkodlarında son rakam kontrol basamağıdır. Mod-10 hesabıyla rakam girişinde oluşan bazı hatalar yakalanabilir; ama ürünün orijinalliğini ispatlamaz.",
  "Sistem “geçerli barkod” dese bile yanlış ürüne eşleştirilmiş olma ihtimalini ürün adıyla doğrula."
 ],
 [
  "Mal Kabul",
  "Kör sayım neden farkı daha iyi yakalar?",
  "Sayımı yapan kişi beklenen miktarı görürse istemeden ona yaklaşan sayı yazabilir. “Kör sayım” bazı süreçlerde bu önyargıyı azaltır.",
  "Şüpheli farkları ikinci personelle bağımsız yeniden saydırmak doğrudan aynı rakamı kopyalamaktan daha değerlidir."
 ],
 [
  "Lot / SKT",
  "İade ürünün tarihi yeniden başlatılmaz",
  "Depodan çıkıp geri gelen ürünün yeni kabul tarihi, ürünün üretim veya son tüketim tarihini değiştirmez.",
  "İade kabulünde ürünün orijinal lotu ve tarihi korunmalı; yeniden değerlendirme gerekir."
 ],
 [
  "Kalite / Gıda",
  "Gizli deformasyon için alt sıralara bak",
  "Paletin üstündeki koliler sağlamken yükün ağırlığını taşıyan alt sıradaki kutular ezilmiş olabilir.",
  "Yalnızca en üst koliye bakıp tüm paletin ambalaj bütünlüğünü onaylama."
 ],
 [
  "Palet / Güvenlik",
  "Kırık palet küçük bir estetik kusur değil",
  "Tahta çatlağı, çıkmış çivi veya eksik takoz, istif ve taşıma sırasında mekanik arıza yaratabilir.",
  "Kusurlu paleti yük altında kullanmadan şirketin ayırma/değiştirme prosedürünü uygula."
 ],
 [
  "WMS / Operasyon",
  "Kayıt hızı ile doğruluk birlikte ölçülmeli",
  "Çok hızlı kabul yapmak fark kayıtlarını artırıyorsa toplamda daha fazla düzeltme ve yeniden sayım işine yol açabilir.",
  "Başarılı kabul oranı, tekrar sayım ve işlem süresini birlikte izle."
 ],
 [
  "GS1 / Barkod",
  "Koli ve tekli ürün farklı GTIN taşıyabilir",
  "Aynı ürünün tekli paketi ve sipariş edilebilir koli ambalajı farklı GTIN numaralarıyla tanımlanabilir.",
  "Koli barkodunu okutup 1 yazdığında, sistemin 1 koli mi 1 adet mi anladığını kontrol et."
 ],
 [
  "Mal Kabul",
  "Mühür numarası yükün tamam olduğunu kanıtlamaz",
  "Araç mührü, taşıma zincirine ilişkin kontrol sağlar; mührün sağlam olması koli sayısının veya ürün kalitesinin doğru olduğunu tek başına ispat etmez.",
  "Varsa mühür numarasını belgeyle doğrula; yine de fiziksel kabul kontrolünü tamamla."
 ],
 [
  "WMS / Operasyon",
  "Darboğaz değişebilir",
  "Sabah sorun rampaysa öğleden sonra ürün sayımı olabilir. Sistemin en yavaş adımı değiştiğinde kaynak dağılımı da değişmelidir.",
  "Sadece araç kuyruğuna değil bekleyen koli, tamamlanmamış sayım ve iş gücü kapasitesine de bak."
 ],
 [
  "GS1 / Barkod",
  "Başına sıfır gelmesi tesadüf olmayabilir",
  "GTIN-13, 14 karakterlik GTIN alanında başına sıfır eklenerek temsil edilebilir. Baştaki sıfırları rastgele silmek eşleştirmeleri bozabilir.",
  "Özellikle Excel’den ürün kodu aktarırken barkod sütununu sayı değil metin biçiminde tut."
 ],
 [
  "Mal Kabul",
  "Tedarikçi kodu ve depo kodu farklı olabilir",
  "Aynı ticari ürün, tedarikçinin sisteminde başka, deponun WMS sisteminde başka kodla tanımlanmış olabilir.",
  "Eşleştirmeyi ad benzerliğine göre değil onaylı ürün kartı ve barkod/GTIN bilgisiyle yap."
 ],
 [
  "WMS / Operasyon",
  "Toplu yüklemede tek hata yüzlerce satırı etkiler",
  "Yanlış ürün–barkod eşleştirmesi çok sayıda sevkiyatta aynı hatayı tekrarlatabilir. Bu, tek bir koli hatasından daha geniş etki yaratır.",
  "Ürün kataloğu değişikliğini onaylı ve izlenebilir tut; yanlış eşleştirmeyi tüm kayıtlarda ara."
 ],
 [
  "GS1 / Barkod",
  "Ürün barkodu fiyat etiketi değildir",
  "GTIN ürünü tanımlar; market satış fiyatını tek başına kodlamaz. Fiyat genellikle ayrı sistem kayıtlarından gelir.",
  "Bir ürünün fiyatı değişince GTIN’inin de değişmesi gerektiğini varsayma."
 ],
 [
  "Mal Kabul",
  "ASN nedir?",
  "ASN (Advanced Shipping Notice), araç gelmeden önce iletilen beklenen sevkiyat bilgisidir. Fiziksel teslimin yerine geçmez.",
  "Ön bildirim 40 koli gösteriyorsa, kabulde sayılan 39 koliyi 40’a tamamlamak yerine farkı kaydet."
 ],
 [
  "WMS / Operasyon",
  "Personel değişince işlem geçmişi kaybolmamalı",
  "Bir kabul işlemini bir personel başlatıp başkası tamamlayabilir; tek kişiye atanan kayıt gerçek çalışma akışını yansıtmayabilir.",
  "Başlatan, sayan ve tamamlayan personel bilgilerini gerektiğinde ayrı izlemek anlaşmazlığı azaltır."
 ],
 [
  "GS1 / Barkod",
  "SSCC etiketinin asıl gücü",
  "SSCC fiziksel palet ile elektronik sevkiyat verisini eşleştirmeye yarar. Ancak içerik verisi sisteme hiç gelmemişse tek taramayla güvenilir sayım yapılamaz.",
  "İrsaliye/ASN verisi olmadan yalnızca SSCC’ye bakıp paletin gerçekten kaç koli taşıdığını kabul etme."
 ],
 [
  "Mal Kabul",
  "İrsaliye numarası neden tek başına yetmez?",
  "Farklı firmalar aynı görünen irsaliye numarasını kullanabilir; belge kimliği tedarikçi ve tarih gibi bağlamlarla değerlendirilmelidir.",
  "Yalnızca irsaliye no arayarak yanlış sevkiyat kaydını açmadığından emin ol."
 ],
 [
  "GS1 / Barkod",
  "Barkod okumak kabul etmek değildir",
  "Tarama, ürünün kodunun okunduğunu kanıtlar; miktarın, kalite durumunun ve teslim belgesinin doğru olduğunu kanıtlamaz.",
  "Tarama başarılı diye kontrol edilmemiş veya hasarlı ürünü otomatik olarak kabul edilmiş sayma."
 ],
 [
  "Mal Kabul",
  "Kısmi teslimat, eksik teslimattan farklıdır",
  "Siparişin planlı olarak iki araçta gelmesi kısmi teslimattır. Tek araçta beyan edilen miktarın az çıkması ise teslimat farkıdır.",
  "İkinci araç bekleniyorsa açık sipariş miktarını ayrı tut; ilk araçta olmayan koliyi hasar/eksik diye otomatik yazma."
 ],
 [
  "GS1 / Barkod",
  "DataMatrix ile sıradan QR aynı şey değil",
  "GS1 DataMatrix, tanımlı uygulama alanlarıyla ürün verisi taşıyabilen 2D standarttır. Her kare kod GS1 uyumlu değildir.",
  "Kamera bir kodu okuyabiliyor diye programın onu otomatik ürün barkodu olarak yorumlayacağını varsayma."
 ],
 [
  "Mal Kabul",
  "Sayım tamamlandı = araç çıkabilir mi?",
  "Sayımın bitmesi, hasar kararının, belge doğrulamasının veya rampa güvenliğinin tamamlandığı anlamına gelmeyebilir.",
  "Sistem durumlarını gerçek operasyon aşamalarına göre ayrı değerlendir; bir butona basılması başka işlemlerin onayı değildir."
 ],
 [
  "Mal Kabul",
  "Gün devri, gece yarısı sıfırlanmaz",
  "Gece 23.00’te gelen ve sabah 07.30’da hâlâ bekleyen araç, tarih değiştiği için görünmez olmamalıdır.",
  "Sabah özeti sadece bugün gelenleri değil önceki günlerden devreden açık kayıtları da göstermeli."
 ],
 [
  "Mal Kabul",
  "Her palet dolu palet değildir",
  "Yarım palet, karışık ürün paleti veya sadece 1 koli içeren palet de fiziksel olarak bir palettir. Palet sayısını otomatik koli sayısına çevirmek yanıltabilir.",
  "Palet sayısını koli sayısından ayrı kaydet; raporda ikisini aynı birimmiş gibi toplama."
 ],
 [
  "Mal Kabul",
  "Teslim anındaki durum sonradan değişebilir",
  "Hasarsız görünen koli açıldığında iç ürün hasarı fark edilebilir. İlk kabul kaydı ile sonradan açılan kalite olayı ayrı izlenmelidir.",
  "Düzeltme gerekiyorsa kimin neyi ne zaman değiştirdiğinin kaydı korunmalı."
 ],
 [
  "Mal Kabul",
  "Sürücü bilgisi sevkiyat kimliği değildir",
  "Aynı şoför farklı araçla, aynı araç da farklı şoförle gelebilir. Şoförü plaka veya irsaliye yerine birincil sevkiyat anahtarı yapmak hataya yol açar.",
  "Şoför geçmişinden telefon önerisi getirilebilir; plaka ve sevkiyat yine doğrulanmalıdır."
 ],
 [
  "Mal Kabul",
  "Teslim alma saati sunucuda tutulmalı",
  "Telefonun saati yanlış ayarlıysa cihazdan alınan zaman damgası operasyon raporlarını kaydırabilir. Sunucu zamanı daha tutarlı bir olay kaydı sağlar.",
  "Önemli durum geçişlerinde kaydın oluştuğu zamanı güvenilir kaynaktan sakla; sadece ekran saatine dayanma."
 ]
];
const KEY='aktiva_count_tip_login_index_v1';
let currentIndex=null, active=false, expanded=false, expandedIndex=null;
function enter(){
 if(active)return;
 active=true;
 try{const saved=localStorage.getItem(KEY);const prev=saved===null?-1:Number(saved);currentIndex=(Number.isFinite(prev)?prev:-1)+1;localStorage.setItem(KEY,String(currentIndex));}
 catch{currentIndex=(currentIndex??-1)+1;}
 expanded=false;expandedIndex=currentIndex;
}
const tip=()=>tips[((currentIndex%tips.length)+tips.length)%tips.length];
document.addEventListener('aktiva:session-changed',()=>{
 if(document.body.dataset.role==='count'){enter();paint();}
 else{active=false;expanded=false;}
});
function paint(){const root=document.querySelector('#akd-dashboard .akd-body');if(!root||document.body.dataset.role!=='count')return;const greeting=root.querySelector('.akd-greeting');if(!greeting)return;if(!active)enter();const key=String(currentIndex);if(expandedIndex!==currentIndex){expanded=false;expandedIndex=currentIndex;}let card=root.querySelector('#akd-daily-tip');if(card&&card.dataset.day===key)return;const [category,title,short,detail]=tip();if(!card){card=document.createElement('section');card.id='akd-daily-tip';card.className='akd-daily-tip';greeting.insertAdjacentElement('afterend',card)}card.dataset.day=key;card.innerHTML='<div class="akd-daily-head"><span>✦ Günün Depo Bilgisi</span><span class="akd-daily-category"></span></div><h2 class="akd-daily-title"></h2><p class="akd-daily-short"></p><p class="akd-daily-detail" hidden></p><button type="button" class="akd-daily-toggle" aria-expanded="false">Detayını Oku ›</button>';card.querySelector('.akd-daily-category').textContent=category;card.querySelector('.akd-daily-title').textContent=title;card.querySelector('.akd-daily-short').textContent=short;card.querySelector('.akd-daily-detail').textContent=detail;const d=card.querySelector('.akd-daily-detail'),b=card.querySelector('button');const sync=()=>{d.hidden=!expanded;b.textContent=expanded?'Detayı Kapat ↑':'Detayını Oku ›';b.setAttribute('aria-expanded',String(expanded))};sync();b.onclick=()=>{expanded=!expanded;sync()};}
function init(){if(!document.getElementById('akd-dashboard'))return;const observer=new MutationObserver(()=>{if(!document.hidden)paint()});observer.observe(document.getElementById('akd-dashboard'),{childList:true,subtree:true});paint();setInterval(paint,60000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
