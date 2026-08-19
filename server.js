const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 1. GÜVENLİK: Kask (Helmet)
app.use(helmet());

// 2. GÜVENLİK: CORS (Sadece senin sitene izin ver)
app.use(cors({
    origin: 'https://readserial-number.onrender.com' 
}));

// 3. GÜVENLİK: Spam Koruması (15 dakikada max 50 istek)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50,
    message: "Çok fazla arama yaptınız, lütfen biraz bekleyin."
});
app.use('/api', limiter); 

// Statik dosyalar (CSS, JS dosyaların varsa aynı klasörde olması için)
app.use(express.static(__dirname));

// ANA SAYFA (HTML Dosyanı burada belirtiyoruz)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'seri-no-sorgulama (4).html'));
});

// ARAMA API'Sİ
app.get('/api/search', (req, res) => {
    const gelenSeriNo = req.query.serial || "";
    
    // Girdi Temizleme (Sadece harf ve rakam kabul et)
    const temizSeriNo = gelenSeriNo.replace(/[^a-zA-Z0-9]/g, '');

    if (!temizSeriNo) {
        return res.status(400).json({ error: "Geçersiz seri numarası!" });
    }

    // BURAYA KENDİ VERİTABANI ARAMA KODLARINI EKLEYECEKSİN
    res.json({ message: "Seri numarası güvenle arandı: " + temizSeriNo });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});