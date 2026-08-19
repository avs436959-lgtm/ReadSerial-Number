const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. KORUMA: HELMET (Arka kapıları kapatır) ---
app.use(helmet());

// --- 2. KORUMA: CORS (Sadece kendi sitene izin ver) ---
app.use(cors({
    origin: 'https://readserial-number.onrender.com' 
}));

// --- 3. KORUMA: ANTI-SPAM (Art arda saldırıları engeller) ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 50, // 15 dakikada maksimum 50 arama yapılabilir
    message: "Çok fazla arama yaptınız, lütfen biraz bekleyin."
});
app.use(limiter);

// --- ANA SAYFAYI GÖSTERME ---
app.get('/', (req, res) => {
    // NOT: HTML dosyanın adı tam olarak neyse (örneğin index.html) onu yaz!
    res.sendFile(__dirname + '/index.html');
});

// --- ARAMA API'Sİ VE 4. KORUMA: GİRDİ TEMİZLEME ---
app.get('/api/search', (req, res) => {
    const gelenSeriNo = req.query.serial || "";
    
    // Sadece harf ve rakamlara izin ver, zararlı kodları sil
    const temizSeriNo = gelenSeriNo.replace(/[^a-zA-Z0-9]/g, '');

    if (!temizSeriNo) {
        return res.status(400).json({ error: "Geçersiz seri numarası!" });
    }

    // BURAYA KENDİ VERİTABANI ARAMA KODLARINI YAZACAKSIN
    // Örnek yanıt:
    res.json({ message: "Seri numarası güvenle arandı: " + temizSeriNo });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda güvenle çalışıyor...`);
});