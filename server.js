// ============================================================
// Seri No Sorgulama - Backend API
// Bu dosya SUNUCUDA çalışır. Şifre ve bağlantı bilgileri
// SADECE burada kalır, tarayıcıya (müşteriye) hiç gönderilmez.
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/seri-no-sorgulama (5).html');
});
app.use(cors());
app.use(express.json());

// ---- Sunucunuzdaki bağlantı bilgileri (.env dosyasından okunur) ----
const dbConfig = {
  server:   process.env.DB_SERVER   || '49.13.144.181',
  database: process.env.DB_DATABASE || 'APLUS_Invoice_new',
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
// NOT: Aşağıdaki tablo adı ve sütun adlarını KENDİ veritabanınıza göre
// düzenlemeniz gerekiyor. Şu an örnek/varsayım isimler kullanılıyor.
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
          det.SerialNumber     AS serial,
          inv.InvoiceKind      AS type,
          inv.InvoiceNo        AS invoiceNo,
          inv.InvoiceDate      AS date,
          inv.Cus_Sup_CompanyName AS company,
          inv.Customer_Name    AS customer,
          inv.Waranty_Kind     AS warrantyKind,
          inv.Waranty_Renew_Date AS warrantyDate
        FROM TInvoiceDetails det
        LEFT JOIN TInvoice inv ON det.ParentId = inv.Id
        WHERE det.SerialNumber = @serial
        ORDER BY inv.InvoiceDate DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Sorgu hatası:', err.message);
    res.status(500).json({ error: 'Sunucu tarafında bir hata oluştu.' });
  }
});

// ---- Tüm seri numaralarını listele (test amaçlı) ----
app.get('/api/serials', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 50 SerialNumber
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
