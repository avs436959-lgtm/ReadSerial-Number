// ============================================================
// Seri No Sorgulama - Backend API
// Bu dosya SUNUCUDA çalışır. Şifre ve bağlantı bilgileri
// SADECE burada kalır, tarayıcıya (müşteriye) hiç gönderilmez.
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// ---- Tamir ve Onarım bölümü girişi ----
// Kullanıcı adı/şifreyi .env dosyasında ADMIN_USERNAME / ADMIN_PASSWORD
// olarak tanımlayın. AUTH_SECRET, giriş jetonunu imzalamak için kullanılır
// ve production'da mutlaka değiştirilmelidir.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const AUTH_SECRET = process.env.AUTH_SECRET || 'lutfen-bu-degeri-degistirin';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat

function createToken(username) {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = username + '.' + expires;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return Buffer.from(payload + '.' + sig, 'utf8').toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [username, expiresStr, sig] = parts;
    const payload = username + '.' + expiresStr;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
    if (Date.now() > Number(expiresStr)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function isRequestAuthed(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token && verifyToken(token);
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ ok: true, token: createToken(username) });
  }
  res.status(401).json({ ok: false, message: 'Kullanıcı adı veya şifre hatalı.' });
});

// ---- Sunucunuzdaki bağlantı bilgileri (.env dosyasından okunur) ----
const dbConfig = {
  server:   process.env.DB_SERVER   || '49.13.144.181',
  database: process.env.DB_DATABASE || 'APLUS_Invoice',
  user:     process.env.DB_USER     || 'avs',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,               // Azure SQL kullanıyorsanız true yapın
    trustServerCertificate: true  // kendi sunucunuzda genelde true kalabilir
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = sql.connect(dbConfig);
  return poolPromise;
}

// ---- Bağlantı test/sağlık kontrolü ----
app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ ok: true, message: 'Veritabanına bağlantı başarılı.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ---- Veritabanındaki tabloları ve sütunları listeler ----
// SSMS kurmanıza gerek kalmadan, tarayıcıdan
// http://localhost:3000/api/tables adresine girerek
// hangi tabloda hangi sütunlar var görebilirsiniz.
app.get('/api/tables', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    // Sütunları tablo bazında grupla, tarayıcıda okunması kolay olsun
    const grouped = {};
    for (const row of result.recordset) {
      if (!grouped[row.TABLE_NAME]) grouped[row.TABLE_NAME] = [];
      grouped[row.TABLE_NAME].push(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
    }
    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Seri no ile sorgulama ----
app.get('/api/search', async (req, res) => {
  const serial = (req.query.serial || '').trim();
  if (!serial) {
    return res.status(400).json({ error: 'Seri no gerekli.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('serial', sql.NVarChar, serial)
      .query(`
        SELECT
          COALESCE(det.SerialNumber, det.SerialNo) AS serial,
          inv.InvoiceKind      AS type,
          inv.InvoiceNo        AS invoiceNo,
          inv.InvoiceDate      AS date,
          inv.Cus_Sup_CompanyName AS company,
          inv.Customer_Name    AS customer,
          inv.Waranty_Kind     AS warrantyKind,
          inv.Waranty_Renew_Date AS warrantyDate
        FROM TInvoiceDetails det
        LEFT JOIN TInvoice inv ON det.ParentId = inv.Id
        WHERE det.SerialNumber = @serial OR det.SerialNo = @serial
        ORDER BY inv.InvoiceDate DESC
      `);

    const rows = isRequestAuthed(req)
      ? result.recordset
      : result.recordset.filter(row => row.type === 0);

    res.json(rows);
  } catch (err) {
    console.error('Sorgu hatası:', err.message);
    res.status(500).json({ error: 'Sunucu tarafında bir hata oluştu.' });
  }
});

// ---- Fatura tiplerinin (InvoiceKind) dağılımı (tanı amaçlı) ----
app.get('/api/invoice-kinds', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT inv.InvoiceKind AS type, COUNT(*) AS count,
             MIN(inv.InvoiceDate) AS earliest, MAX(inv.InvoiceDate) AS latest
      FROM TInvoiceDetails det
      LEFT JOIN TInvoice inv ON det.ParentId = inv.Id
      GROUP BY inv.InvoiceKind
      ORDER BY inv.InvoiceKind
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Tüm seri numaralarını listele (test amaçlı) ----
app.get('/api/serials', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT SerialNumber
      FROM TInvoiceDetails
      WHERE SerialNumber IS NOT NULL AND SerialNumber != ''
      GROUP BY SerialNumber
      ORDER BY SerialNumber
    `);

    const serials = result.recordset.map(row => row.SerialNumber);
    res.json({ serials });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API ${PORT} portunda çalışıyor  ->  http://localhost:${PORT}/api/health`);
});
