# Seri No Sorgulama - Kurulum

## Neden bir "backend" gerekiyor?
Tarayıcıda çalışan web sayfası, doğrudan SQL Server'a bağlanamaz ve şifreyi
sayfa içinde saklamak güvenli değildir (herkes "sayfa kaynağını görüntüle"
diyerek şifreyi okuyabilir). Bu yüzden şifre **sadece sunucuda çalışan
küçük bir API'de** (`server.js`) tutulur. Müşteri sadece seri no gönderir,
API veritabanını sorgular ve sonucu döner — şifreyi hiçbir zaman görmez.

## Dosyalar
- `server.js` — API (Node.js + Express + mssql)
- `package.json` — gerekli paketler
- `.env.example` — bağlantı bilgileri şablonu
- `seri-no-sorgulama.html` — müşterinin göreceği arayüz

## Kurulum adımları

1. **Node.js kurun** (sunucunuzda yoksa): https://nodejs.org

2. Bu klasörü sunucunuza (49.13.144.181 veya erişebileceği başka bir makineye) kopyalayın.

3. `.env.example` dosyasını `.env` olarak kopyalayın ve gerçek şifrenizi girin:
   ```
   cp .env.example .env
   ```
   `.env` içindeki `DB_PASSWORD` alanına gerçek şifrenizi yazın.

4. Paketleri kurun:
   ```
   npm install
   ```

5. API'yi başlatın:
   ```
   npm start
   ```
   Tarayıcıdan `http://localhost:3000/api/health` adresine giderek
   bağlantının çalıştığını test edebilirsiniz ("Veritabanına bağlantı
   başarılı." yazısını görmelisiniz).

6. **Tablo/sütun isimlerini öğrenin — SSMS'e gerek yok.**
   Tarayıcıdan şu adrese girin:
   ```
   http://localhost:3000/api/tables
   ```
   Karşınıza veritabanınızdaki tüm tabloların ve sütunların bir listesi
   çıkacak. İçinde faturalarla ilgili görünen tabloyu (örn. `Faturalar`,
   `Invoices`, `INV_Header` gibi bir isim) ve seri no, fatura tipi, tarih,
   şirket, müşteri, kefalet/garanti durumu gibi bilgilerin hangi sütun
   adlarıyla tutulduğunu bulun. Bu listeyi bana kopyalayıp gönderirseniz,
   `server.js` içindeki sorguyu (7. adımdaki `FaturaTipi`/`SeriNo` gibi
   örnek isimler yerine) gerçek isimlerinizle güncelleyip size geri
   veririm.

7. **`server.js` içindeki tabloyu kendi veritabanınıza göre düzenleyin.**
   Şu an örnek isimler var (`Faturalar` tablosu, `SeriNo`, `FaturaTipi` vb.
   sütunlar) — bir önceki adımda bulduğunuz gerçek isimlerle değiştirin
   (ya da bana gönderin, ben düzenleyeyim).

7. **Önemli — HTTPS gerekiyor:** `seri-no-sorgulama.html` bir web sayfası
   olduğu için, tarayıcı güvenlik kuralları gereği API'nizin de `https://`
   üzerinden erişilebilir olması gerekir (düz `http://` ile açık internette
   çalışmaz). Bunun için sunucunuzda bir ters proxy (nginx/Caddy) ile
   ücretsiz bir SSL sertifikası (Let's Encrypt) kurmanız gerekir. İsterseniz
   bu adımda da yardımcı olabilirim.

8. `seri-no-sorgulama.html` dosyasını açıp sayfanın en altındaki küçük
   noktaya **3 kez tıklayın** — API adresinizi buraya girin (örn.
   `https://api.sizinsirketiniz.com/api`) ve "Bağlantıyı Test Et"e basın.

## Güvenlik notu
`.env` dosyasını asla müşteriyle, github ile veya herhangi bir yerde
paylaşmayın — içinde veritabanı şifreniz var.
