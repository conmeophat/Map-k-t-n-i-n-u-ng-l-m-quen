import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(rootDir, 'public')));

// ---- Database ----
const db = new Database(path.join(rootDir, 'backend', 'foodie.db'));
db.pragma('journal_mode = WAL');

// Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,          -- food | shopping | cafe | nightlife
    city TEXT NOT NULL,
    address TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    description TEXT,
    price_min INTEGER,
    price_max INTEGER,
    avg_rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    rating INTEGER NOT NULL,          -- 1..5
    food_quality INTEGER,             -- 1..5 chat luong do an
    price_value INTEGER,              -- 1..5 gia tien hop ly
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(place_id) REFERENCES places(id)
  );

  CREATE TABLE IF NOT EXISTS find_partner (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,          -- Họ và tên đầy đủ (bí mật)
    first_name TEXT NOT NULL,         -- Tên (không họ) - hiển thị công khai
    age INTEGER NOT NULL,
    phone TEXT NOT NULL,              -- SĐT (bí mật)
    destination TEXT NOT NULL,        -- Mục tiêu/muốn đến
    depart_time TEXT NOT NULL,        -- Giờ đi (ví dụ: 11:30, 18:00)
    depart_date TEXT NOT NULL,        -- Ngày đi (ví dụ: 2026-10-24)
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS partner_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a_id INTEGER NOT NULL,
    user_b_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_a_id, user_b_id)
  );
`);

// ---- Helpers ----
function placeToJSON(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    price_min: row.price_min,
    price_max: row.price_max,
    avg_rating: row.avg_rating,
    review_count: row.review_count,
    created_at: row.created_at
  };
}


// ---- Danh sách 63 tỉnh thành Việt Nam ----
const VIETNAM_CITIES = [
  'Hà Nội', 'Hải Phòng', 'Bắc Ninh', 'Hà Nam', 'Hải Dương',
  'Hưng Yên', 'Nam Định', 'Ninh Bình', 'Thái Bình', 'Vĩnh Phúc',
  'Quảng Ninh', 'Bắc Giang', 'Bắc Kạn', 'Cao Bằng', 'Điện Biên',
  'Hà Giang', 'Hòa Bình', 'Lai Châu', 'Lạng Sơn', 'Lào Cai',
  'Phú Thọ', 'Sơn La', 'Thái Nguyên', 'Tuyên Quang', 'Yên Bái',
  'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị',
  'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định',
  'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum',
  'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng', 'TP.HCM',
  'Bà Rịa - Vũng Tàu', 'Bình Dương', 'Bình Phước', 'Đồng Nai', 'Tây Ninh',
  'Cần Thơ', 'Long An', 'Tiền Giang', 'Bến Tre', 'Trà Vinh',
  'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Kiên Giang', 'Hậu Giang',
  'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'
];

// API trả về danh sách tỉnh thành (có đánh dấu thành phố nào có địa điểm)
app.get('/api/cities', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT city FROM places ORDER BY city').all();
  const existing = new Set(rows.map(r => r.city));
  res.json(VIETNAM_CITIES.map(c => ({ name: c, hasPlaces: existing.has(c) })));
});

// ---- Seed data (if empty) ----
const count = db.prepare('SELECT COUNT(*) as c FROM places').get().c;
if (count === 0) {
  const insert = db.prepare(`INSERT INTO places
    (name, category, city, address, lat, lng, description, price_min, price_max)
    VALUES (@name, @category, @city, @address, @lat, @lng, @description, @price_min, @price_max)`);
  const seed = [
    ['Phở Gia Truyền Bát Đàn', 'food', 'Hà Nội', '49 Bát Đàn, Hoàn Kiếm', 21.0335, 105.8506, 'Phở bò truyền thống nổi tiếng, nước dùng đậm đà.', 40000, 70000],
    ['Bún Chả Hương Liên', 'food', 'Hà Nội', '24 Lê Văn Hưu, Hai Bà Trưng', 21.0179, 105.8540, 'Bún chả Obama từng ghé, chả nướng thơm ngon.', 45000, 90000],
    ['Bánh Mì Huỳnh Hoa', 'food', 'TP.HCM', '26 Lê Thị Riêng, Quận 1', 10.7694, 106.6890, 'Bánh mì thịt nguội đầy ắp, xếp hàng dài.', 60000, 68000],
    ['Cơm Tấm Ba Ghiền', 'food', 'TP.HCM', '84 Đặng Văn Ngữ, Phú Nhuận', 10.7932, 106.6777, 'Sườn nướng đặc trưng, cơm tấm nổi tiếng.', 80000, 140000],
    ['Mì Quảng Quán Cô Thảo', 'food', 'Đà Nẵng', '44 Nguyễn Văn Thoại', 16.0637, 108.2423, 'Mì quảng chuẩn vị Đà Nẵng, đậm chất địa phương.', 30000, 50000],
    ['Bánh Xèo Bà Dưỡng', 'food', 'Đà Nẵng', 'K280/23 Hoàng Diệu', 16.0560, 108.2200, 'Bánh xèo giòn rụm, nước chấm đặc biệt.', 35000, 70000],
    ['Cà Phê Giảng', 'cafe', 'Hà Nội', '39 Nguyễn Hữu Huân', 21.0331, 105.8524, 'Cà phê trứng huyền thoại, không gian cổ kính.', 30000, 60000],
    ['Công Viên 29/3', 'shopping', 'Đà Nẵng', 'Quận Thanh Khê', 16.0680, 108.2200, 'Khu mua sắm quà lưu niệm và ẩm thực đêm.', 20000, 200000],
    ['Chợ Bến Thành', 'shopping', 'TP.HCM', 'Quận 1, TP.HCM', 10.7725, 106.6980, 'Chợ truyền thống, đủ loại hàng hoá và ẩm thực.', 15000, 300000],
    ['Chợ Đồng Xuân', 'shopping', 'Hà Nội', 'Hoàn Kiếm', 21.0390, 105.8510, 'Khu chợ lớn nhất Hà Nội, hàng hoá phong phú.', 10000, 200000],
    ['Chả Mực Hạ Long', 'food', 'Quảng Ninh', 'Hạ Long', 20.9600, 107.0500, 'Chả mực Hạ Long giòn dai, đặc sản nổi tiếng.', 100000, 200000],
    ['Bánh Cuốn Gia An', 'food', 'Hà Nội', 'Quận Ba Đình', 21.0350, 105.8200, 'Bánh cuốn nóng hổi, nhân thịt mộc nhĩ.', 25000, 40000],
    ['Nem Chua Thanh Hóa', 'food', 'Thanh Hóa', 'TP. Thanh Hóa', 19.8075, 105.7764, 'Nem chua dẻo thơm, vị chua thanh đặc trưng.', 50000, 80000],
    ['Kẹo Cu Đơ Hà Tĩnh', 'shopping', 'Hà Tĩnh', 'TP. Hà Tĩnh', 18.3428, 105.9057, 'Kẹo cu đơ lạc giòn, quà đặc sản Hà Tĩnh.', 20000, 50000],
    ['Bánh Bèo Xứ Huế', 'food', 'Thừa Thiên Huế', 'Huế', 16.4637, 107.5909, 'Bánh bèo chén nhỏ, tôm chấy thơm ngon.', 20000, 45000],
    ['Bún Bò Huế O Vân', 'food', 'Thừa Thiên Huế', 'Huế', 16.4670, 107.5930, 'Bún bò Huế cay nồng, đậm đà chuẩn vị.', 45000, 70000],
    ['Cao Lầu Hội An', 'food', 'Quảng Nam', 'Hội An', 15.8796, 108.3264, 'Cao lầu sợi mì đặc biệt, chỉ Hội An mới có.', 35000, 60000],
    ['Mì Quảng Bà Mua', 'food', 'Quảng Nam', 'Hội An', 15.8800, 108.3380, 'Mì quảng tôm thịt, đậm vị miền Trung.', 30000, 55000],
    ['Bánh Tráng Trộn Đà Lạt', 'food', 'Lâm Đồng', 'Đà Lạt', 11.9465, 108.4420, 'Bánh tráng trộn chua cay, món ăn vặt trứ danh.', 20000, 40000],
    ['Cà Phê Làng Đà Lạt', 'cafe', 'Lâm Đồng', 'Đà Lạt', 11.9400, 108.4400, 'Cà phê Arabica thơm nồng, view đồi thông.', 35000, 80000],
    ['Bún Cá Hải Phòng', 'food', 'Hải Phòng', 'Quận Lê Chân', 20.8480, 106.6880, 'Bún cá nóng, chả cá thơm, nước dùng ngọt.', 30000, 50000],
    ['Nem Rán Hải Phòng', 'food', 'Hải Phòng', 'Quận Hồng Bàng', 20.8550, 106.6800, 'Nem cua bể giòn rụm, đặc sản Hải Phòng.', 40000, 65000],
    ['Bún Nước Lèo Sóc Trăng', 'food', 'Sóc Trăng', 'TP. Sóc Trăng', 9.6037, 105.9796, 'Bún nước lèo đậm vị Khmer, mắm bò hóc đặc trưng.', 30000, 50000],
    ['Bánh Pía Sóc Trăng', 'shopping', 'Sóc Trăng', 'TP. Sóc Trăng', 9.6000, 105.9700, 'Bánh pía sầu riêng, đặc sản miền Tây.', 25000, 60000],
    ['Hủ Tiếu Mỹ Tho', 'food', 'Tiền Giang', 'Mỹ Tho', 10.3600, 106.3610, 'Hủ tiếu dai ngon, nước dùng ngọt thanh.', 30000, 55000],
    ['Kẹo Dừa Bến Tre', 'shopping', 'Bến Tre', 'TP. Bến Tre', 10.2410, 106.3750, 'Kẹo dừa dẻo béo, đặc sản nức tiếng.', 25000, 50000],
    ['Bánh Khọt Vũng Tàu', 'food', 'Bà Rịa - Vũng Tàu', 'Vũng Tàu', 10.3460, 107.0840, 'Bánh khọt nhỏ giòn, tôm tươi, nước mắm chua ngọt.', 40000, 70000],
    ['Gỏi Cá Mai Nha Trang', 'food', 'Khánh Hòa', 'Nha Trang', 12.2388, 109.1967, 'Gỏi cá mai tươi sống, đặc sản biển Nha Trang.', 45000, 80000],
    ['Yến Sào Khánh Hòa', 'shopping', 'Khánh Hòa', 'Nha Trang', 12.2400, 109.1900, 'Yến sào thượng hạng, quà biếu cao cấp.', 500000, 3000000],
    ['Bánh Căn Phan Thiết', 'food', 'Bình Thuận', 'Phan Thiết', 10.9330, 108.1020, 'Bánh căn nhỏ nóng hổi, ăn kèm nước mắm.', 20000, 40000],
    ['Nước Mắm Phan Thiết', 'shopping', 'Bình Thuận', 'Phan Thiết', 10.9300, 108.1000, 'Nước mắm cốt nhĩ, thương hiệu nổi tiếng.', 80000, 300000],
    ['Bún Chả Cá Quy Nhơn', 'food', 'Bình Định', 'Quy Nhơn', 13.7700, 109.2200, 'Chả cá dai ngon, nước dùng ngọt từ xương.', 30000, 50000],
    ['Cơm Lam Gia Lai', 'food', 'Gia Lai', 'Pleiku', 13.9800, 108.0100, 'Cơm lam nướng ống tre, ăn kèm gà nướng.', 40000, 80000],
    ['Cà Phê Buôn Ma Thuột', 'cafe', 'Đắk Lắk', 'Buôn Ma Thuột', 12.6660, 108.0370, 'Cà phê Robusta đậm vị, thủ phủ cà phê Việt Nam.', 25000, 60000],
    ['Chả Cá Lã Vọng', 'food', 'Hà Nội', '14 Chả Cá, Hoàn Kiếm', 21.0310, 105.8510, 'Chả cá lăng nướng tảng, thì là và mắm tôm.', 150000, 300000],
    ['Bánh Mì Phượng', 'food', 'Quảng Nam', 'Hội An', 15.8770, 108.3310, 'Bánh mì nổi tiếng thế giới, đặc sản Hội An.', 25000, 45000],
    ['Lẩu Thả Phan Thiết', 'food', 'Bình Thuận', 'Phan Thiết', 10.9350, 108.1050, 'Lẩu thả hải sản tươi sống.', 100000, 250000],
    ['Bánh Hỏi Cháo Lòng Hồng Thanh', 'food', 'Bình Định', '22 Phan Bội Châu, Quy Nhơn', 13.7720, 109.2260, 'Bánh hỏi cháo lòng nổi tiếng, lòng heo giòn dai.', 25000, 40000],
    ['Bánh Hỏi Cháo Lòng Mẫn', 'food', 'Bình Định', '76A Trần Phú, Quy Nhơn', 13.7745, 109.2220, 'Quán lâu đời, chỉ bán buổi sáng.', 25000, 40000],
    ['Bún Cá Thùy', 'food', 'Bình Định', '262 Tăng Bạc Hổ, Quy Nhơn', 13.7705, 109.2215, 'Bún cá đa dạng: cá, mực, sứa, thập cẩm.', 30000, 50000],
    ['Bún Chả Cá Phượng Tèo', 'food', 'Bình Định', '211 Nguyễn Huệ, Quy Nhơn', 13.7755, 109.2250, 'Bún chả cá nổi tiếng, chả cá dai ngon.', 30000, 50000],
    ['Bún Cá Ngọc Liên', 'food', 'Bình Định', '379 Nguyễn Huệ, Quy Nhơn', 13.7770, 109.2230, 'Bún cá ngon nổi tiếng, nước dùng ngọt thanh.', 30000, 50000],
    ['Bún Cá Cô Huệ', 'food', 'Bình Định', 'TP. Quy Nhơn, Bình Định', 13.7700, 109.2200, 'Bún cá cô Huệ được nhiều người yêu thích.', 25000, 45000],
    ['Bánh Xèo Gia Vỹ', 'food', 'Bình Định', '14 Diên Hồng, Quy Nhơn', 13.7730, 109.2270, 'Bánh xèo tôm nhảy giòn rụm, bán cả ngày.', 25000, 50000],
    ['Bánh Xèo Anh Vũ', 'food', 'Bình Định', '82 Diên Hồng, Quy Nhơn', 13.7710, 109.2265, 'Bánh xèo tôm nhảy, quấn bánh tráng.', 25000, 50000],
    ['Bánh Xèo Tôm Nhảy Phước Sơn', 'food', 'Bình Định', 'Quy Nhơn, Bình Định', 13.7690, 109.2280, 'Bánh xèo tôm nhảy Phước Sơn nổi tiếng.', 25000, 50000],
    ['Bánh Xèo Tôm Nhảy Mộc Miên', 'food', 'Bình Định', 'Quy Nhơn, Bình Định', 13.7700, 109.2240, 'Bánh xèo tôm nhảy giòn, nhân đầy.', 25000, 50000],
    ['Bánh Canh Bà O', 'food', 'Bình Định', '384 Bạch Đằng, Quy Nhơn, Bình Định', 13.7800, 109.2400, 'Bánh canh nêm đủ gia vị, nước dùng đậm.', 20000, 35000],
    ['Bánh Canh Ba Biên', 'food', 'Bình Định', '173 Phan Đình Phùng, Quy Nhơn, Bình Định', 13.7780, 109.2380, 'Bánh canh mở sáng và chiều.', 20000, 35000],
    ['Cơm Nhà 1989', 'food', 'Bình Định', 'Ngã 4 Nguyễn Thị Định - Bùi Hữu Nghĩa, Quy Nhơn', 13.7820, 109.2300, 'Cơm nhà ấm cúng, chuẩn vị miền Trung.', 30000, 60000],
    ['Cơm Niêu Hội An', 'food', 'Bình Định', '114 Nguyễn Tất Thành, Quy Nhơn', 13.7900, 109.2150, 'Cơm niêu thơm, gây nhớ thương.', 40000, 90000],
    ['Nem Chả Nướng Lợi', 'food', 'Bình Định', '113 Tăng Bạc Hổ, Quy Nhơn', 13.7715, 109.2225, 'Nem chả nướng thơm lừng, đặc sản Quy Nhơn.', 25000, 50000],
    ['Bánh Bèo 08 Nguyễn Thái Học', 'food', 'Bình Định', '08 Nguyễn Thái Học, Quy Nhơn', 13.7725, 109.2245, 'Bánh bèo chén nhỏ, tôm chấy thơm.', 15000, 30000],
    ['Bánh Mì Lagu Hẻm 171', 'food', 'Bình Định', 'Hẻm 171 Nguyễn Huệ, Quy Nhơn', 13.7760, 109.2240, 'Bánh mì lagu mở từ 2h chiều đến tối.', 20000, 40000],
    ['Hải Sản Chín Mẫn', 'food', 'Bình Định', '86 Xuân Diệu, Quy Nhơn', 13.7740, 109.2320, 'Hải sản tươi sống, nổi tiếng Quy Nhơn.', 100000, 300000],
    ['Nhà Hàng 114', 'food', 'Bình Định', '114 Xuân Diệu, Quy Nhơn', 13.7750, 109.2330, 'Nhà hàng hải sản tại khu Bờ Hồ.', 100000, 350000],
    ['Hải Sản Cây Dừa Bờ Hồ', 'food', 'Bình Định', '05 Lê Lợi, Quy Nhơn', 13.7735, 109.2310, 'Hải sản tại Bờ Hồ, thoáng mát.', 80000, 300000],
    ['Tàu Hoa Hoa', 'food', 'Bình Định', '3/8 Phan Châu Trinh, Quy Nhơn', 13.7765, 109.2280, 'Hải sản tươi ngon, đa dạng đặc trưng vùng miền.', 100000, 300000],
    ['Hoài Hương 2', 'food', 'Bình Định', 'Lô D2 Nguyễn Trung Tín, Quy Nhơn', 13.7850, 109.2350, 'Nhà hàng hải sản uy tín Quy Nhơn.', 120000, 400000],
    ['Quán Mộng Mơ', 'food', 'Bình Định', 'Đường nội bộ Xuân Diệu, Quy Nhơn', 13.7745, 109.2315, 'Quán hải sản bình dân.', 60000, 200000],
    ['Kim Ngân', 'food', 'Bình Định', '154 Xuân Diệu, Quy Nhơn', 13.7760, 109.2335, 'Quán hải sản bình dân, giá phải chăng.', 60000, 200000],
    ['Hải Sản Nghĩa Ghẹ', 'food', 'Bình Định', '19 Võ Đình Tú, Quy Nhơn', 13.7720, 109.2290, 'Ghẹ tươi sống, đặc sản biển.', 80000, 300000],
    ['Ốc Thúy Kiều', 'food', 'Bình Định', '5D Tăng Bạc Hổ, Quy Nhơn', 13.7700, 109.2220, 'Quán ốc nổi tiếng Quy Nhơn.', 30000, 100000],
    ['Ốc Cô Xí', 'food', 'Bình Định', '40 Duy Tân, Quy Nhơn', 13.7780, 109.2260, 'Ốc tươi, đa dạng loại.', 30000, 100000],
    ['Ốc Hảo', 'food', 'Bình Định', '248 Xuân Diệu, Quy Nhơn', 13.7770, 109.2340, 'Quán ốc dọc đường biển.', 30000, 100000],
    ['Ốc 96 Mai Xuân Thưởng', 'food', 'Bình Định', '96 Mai Xuân Thưởng, Quy Nhơn', 13.7730, 109.2190, 'Ốc và nem, bánh bèo, bánh hỏi.', 30000, 100000],
    ['Buffet Hải Sản Ố Lè', 'food', 'Bình Định', 'Quy Nhơn, Bình Định', 13.7790, 109.2280, 'Buffet hải sản nổi tiếng.', 150000, 300000],
    ['HALO BBQ - Buffet Quy Nhơn', 'food', 'Bình Định', 'Quy Nhơn, Bình Định', 13.7800, 109.2290, 'BBQ buffet, đồ nướng đa dạng.', 150000, 300000],
    ['Chè Nhớ', 'cafe', 'Bình Định', '134 Ngô Mây, Quy Nhơn', 13.7715, 109.2210, 'Chè ngon nổi tiếng Quy Nhơn.', 15000, 35000],
    ['Chè Ngon', 'cafe', 'Bình Định', '21A Ngô Quyền, Quy Nhơn', 13.7725, 109.2230, 'Chè đa dạng, ngon mát.', 15000, 35000],
    ['Sinh Tố Kim Đình', 'cafe', 'Bình Định', '20 Nguyễn Huệ, Quy Nhơn', 13.7740, 109.2240, 'Sinh tố trái cây tươi ngon.', 15000, 40000],
    ['Kem Bơ Aloo', 'cafe', 'Bình Định', '395 Nguyễn Huệ, Quy Nhơn', 13.7780, 109.2235, 'Kem bơ sầu riêng thơm béo.', 20000, 45000],
    ['Surf Bar', 'cafe', 'Bình Định', 'Đường biển Xuân Diệu, Quy Nhơn', 13.7735, 109.2330, 'Cafe view biển, không gian đẹp.', 30000, 80000],
    ['Marina Royal', 'cafe', 'Bình Định', '138 Đô Đốc Bảo, Quy Nhơn', 13.7890, 109.2180, 'Cafe không gian đẹp, tươi mát.', 30000, 90000],
    ['Trung Nguyên Legend', 'cafe', 'Bình Định', '172 Diên Hồng, Quy Nhơn', 13.7705, 109.2260, 'Cà phê Trung Nguyên chuẩn vị.', 30000, 80000],
    ['Highland Coffee', 'cafe', 'Bình Định', '100 Phạm Hùng, Quy Nhơn', 13.7800, 109.2200, 'Cafe thương hiệu quen thuộc.', 35000, 90000],
    ['Chợ Đêm Quy Nhơn', 'shopping', 'Bình Định', 'Trung tâm Quy Nhơn', 13.7720, 109.2220, 'Chợ đêm: thiên đường ẩm thực & mua sắm.', 10000, 200000],
    ['Phố Ẩm Thực Phan Bội Châu', 'shopping', 'Bình Định', 'Phan Bội Châu, Quy Nhơn', 13.7730, 109.2250, 'Phố ẩm thực đặc sản địa phương.', 10000, 150000],
    ['Phố Ẩm Thực Ngô Văn Sở', 'shopping', 'Bình Định', 'Ngô Văn Sở, Quy Nhơn', 13.7710, 109.2200, 'Phố ẩm thực ăn vặt.', 10000, 100000],
    ['Phố Ẩm Thực Trần Bình Trọng', 'shopping', 'Bình Định', 'Trần Bình Trọng, Quy Nhơn', 13.7740, 109.2230, 'Phố ẩm thực Quy Nhơn.', 10000, 100000],
    ['Cơm Tấm 173', 'food', 'Bình Định', '173 Nguyễn Huệ, Quy Nhơn, Bình Định', 13.7748, 109.2248, 'Quán cơm bình dân ngon nổi tiếng. Sườn chỉ 25k.', 20000, 30000],
    ['Cơm Tấm Bảy Quán', 'food', 'Bình Định', 'Nguyễn Huệ, Quy Nhơn', 13.7740, 109.2240, 'Cơm tấm, cơm gà ngon trên đường Nguyễn Huệ, giá bình dân.', 20000, 30000],
    ['Chè Cô Thúy', 'cafe', 'Bình Định', '139 Nguyễn Huệ, Quy Nhơn', 13.7742, 109.2242, 'Hàng chè lâu đời, ít ngọt nổi tiếng Quy Nhơn. 12-15k/ly.', 12000, 15000],
    ['Bếp Cơm Ngon Nguyễn Huệ', 'food', 'Bình Định', 'Nguyễn Huệ, Quy Nhơn', 13.7750, 109.2245, 'Quán cơm bình dân dọc đường Nguyễn Huệ.', 20000, 30000],
    ['Cơm Bình Dân Nguyễn Huệ', 'food', 'Bình Định', 'Đường Nguyễn Huệ, Quy Nhơn, Bình Định', 13.7735, 109.2238, 'Cơm bình dân sinh viên, giá rẻ chỉ 20-30k.', 20000, 30000],
    ['Cơm Tấm Ghiền Quy Nhơn', 'food', 'Bình Định', 'Quy Nhơn, Bình Định', 13.7720, 109.2220, 'Quán cơm tấm bình dân đậm đà hương đồng quê.', 20000, 35000],
    ['Cơm Thị Trần Cao Vân', 'food', 'Bình Định', 'Trần Cao Vân, Quy Nhơn', 13.7710, 109.2190, 'Quán cơm ngon như mẹ nấu.', 25000, 40000],
    ['Cơm Chiên Trùm Trứng', 'food', 'Bình Định', 'Quy Nhơn, Bình Định', 13.7725, 109.2235, 'Cơm chiên trùm trứng, giá từ 20k.', 20000, 35000],
    ['Bún Chả Cá Hoa Lư', 'food', 'Bình Định', '40 An Dương Vương, Quy Nhơn', 13.7730, 109.2250, 'Bún chả cá tô đầy ú ụ, chả cá dai ngon.', 25000, 50000],
    ['Bún Cá Hồ Thị', 'food', 'Bình Định', '279 Trần Hưng Đạo, Quy Nhơn', 13.7700, 109.2180, 'Bún cá siêu nổi tiếng Quy Nhơn.', 25000, 50000],
    ['Bánh Bèo Bà Xê', 'food', 'Bình Định', '62 Phan Thúc Trực, Quy Nhơn', 13.7715, 109.2205, 'Bánh bèo chén, tôm khô, mỡ hành.', 15000, 30000],
    ['Bánh Hỏi Cháo Lòng 20 Diên Hồng', 'food', 'Bình Định', '20 Diên Hồng, Quy Nhơn', 13.7730, 109.2265, 'Bánh hỏi cháo lòng quốc dân.', 30000, 45000],
    ['Nem Nướng Cô Diễm', 'food', 'Bình Định', '20 Trần Văn Ơn, Quy Nhơn', 13.7720, 109.2270, 'Nem nướng thơm lừng, cuốn bánh tráng.', 12000, 25000],
    ['Bánh Mì Lagu 104 Trần Phú', 'food', 'Bình Định', '104 Trần Phú, Quy Nhơn', 13.7740, 109.2215, 'Bánh mì lagu giòn nóng, bò mềm rục.', 25000, 45000],
    ['Bánh Mì Lagu Bò Kho 71 Ngô Mây', 'food', 'Bình Định', '71 Ngô Mây, Quy Nhơn', 13.7710, 109.2200, 'Bánh mì lagu bò kho sánh ngọt.', 25000, 45000],
    ['Chè Xổm', 'cafe', 'Bình Định', '195A Bạch Đằng, Quy Nhơn', 13.7760, 109.2380, 'Chè Xổm khu ẩm thực đường Bạch Đằng.', 10000, 20000],
    ['Bánh Xèo Mỹ Cang', 'food', 'Bình Định', '114 Đống Đa, Quy Nhơn', 13.7690, 109.2250, 'Bánh xèo tôm nhảy giòn rụm, ăn kèm rau mầm, xoài.', 25000, 40000],
    ['Bánh Xèo Gia Vỹ 2', 'food', 'Bình Định', '14 Diên Hồng, Quy Nhơn', 13.7730, 109.2270, 'Bánh xèo tôm nhảy nổi tiếng, nước chấm chua ngọt.', 25000, 40000]
  ];
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run({
        name: r[0], category: r[1], city: r[2], address: r[3],
        lat: r[4], lng: r[5], description: r[6], price_min: r[7], price_max: r[8]
      });
    }
  });
  tx(seed);
  console.log('Seeded ' + seed.length + ' places');
}

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// List places (with filters)
app.get('/api/places', (req, res) => {
  const { category, city, q, price_min, price_max } = req.query;
  let sql = 'SELECT * FROM places WHERE 1=1';
  const params = [];
  if (category && category !== 'all') { sql += ' AND category = ?'; params.push(category); }
  if (city && city !== 'all') { sql += ' AND city = ?'; params.push(city); }
  if (q) { sql += ' AND (name LIKE ? OR address LIKE ? OR description LIKE ?)'; params.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
  // Lọc theo giá:
  // "Giá từ X" (price_min) => quán có giá cao nhất >= X (price_max >= X)
  // "Đến Y" (price_max) => quán có giá thấp nhất <= Y (price_min <= Y)
  if (price_min && price_min !== 'all') {
    sql += ' AND (price_max >= ? OR price_min >= ?)';
    params.push(Number(price_min), Number(price_min));
  }
  if (price_max && price_max !== 'all') {
    sql += ' AND (price_min <= ? OR (price_min IS NULL AND price_max IS NULL))';
    params.push(Number(price_max));
  }
  sql += ' ORDER BY review_count DESC, avg_rating DESC';
  const rows = db.prepare(sql).all(...params).map(placeToJSON);
  res.json(rows);
});

// Get one place with reviews
app.get('/api/places/:id', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });
  const reviews = db.prepare('SELECT * FROM reviews WHERE place_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ place: placeToJSON(place), reviews });
});

// Add a place
app.post('/api/places', (req, res) => {
  const { name, category, city, address, lat, lng, description, price_min, price_max } = req.body;
  if (!name || !category || !city || lat == null || lng == null) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (name, category, city, lat, lng)' });
  }
  const info = db.prepare(`INSERT INTO places
    (name, category, city, address, lat, lng, description, price_min, price_max)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(name, category, city, address || '', lat, lng, description || '', price_min || null, price_max || null);
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(placeToJSON(place));
});

// Cập nhật địa điểm (địa chỉ, tên, giá...)
app.put('/api/places/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });
  const { name, category, city, address, lat, lng, description, price_min, price_max } = req.body;
  db.prepare(`UPDATE places SET
    name = ?, category = ?, city = ?, address = ?, lat = ?, lng = ?,
    description = ?, price_min = ?, price_max = ?
    WHERE id = ?`).run(
      name ?? existing.name,
      category ?? existing.category,
      city ?? existing.city,
      address ?? existing.address,
      lat ?? existing.lat,
      lng ?? existing.lng,
      description ?? existing.description,
      price_min ?? existing.price_min,
      price_max ?? existing.price_max,
      req.params.id
    );
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  res.json(placeToJSON(place));
});

// Xóa địa điểm (quán phá sản/đóng cửa)
app.delete('/api/places/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });
  // Xóa tất cả review liên quan trước (FK constraint)
  db.prepare('DELETE FROM reviews WHERE place_id = ?').run(req.params.id);
  db.prepare('DELETE FROM places WHERE id = ?').run(req.params.id);
  res.json({ ok: true, deleted: { id: Number(req.params.id), name: existing.name } });
});

// Add a review
app.post('/api/places/:id/reviews', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });
  const { author, rating, food_quality, price_value, comment } = req.body;
  const r = Number(rating);
  if (!author || !Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Cần tên người review và rating từ 1-5' });
  }
  const info = db.prepare(`INSERT INTO reviews
    (place_id, author, rating, food_quality, price_value, comment)
    VALUES (?,?,?,?,?,?)`).run(
      Number(req.params.id), author, r,
      food_quality != null ? Number(food_quality) : null,
      price_value != null ? Number(price_value) : null,
      comment || ''
    );

  // Update aggregate
  const agg = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE place_id = ?').get(req.params.id);
  db.prepare('UPDATE places SET avg_rating = ?, review_count = ? WHERE id = ?')
    .run(Math.round(agg.avg * 10) / 10, agg.cnt, req.params.id);

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(review);
});

// ============ Tìm bạn đi cùng ============

// Hàm tách TÊN (không họ) từ Họ và tên đầy đủ
function extractFirstName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : '';
}

// Đăng ký tìm bạn đi cùng
// Kiểm tra format mục tiêu: "Tên địa điểm (Số nhà Tên đường)"
// Ví dụ hợp lệ: Cafe G-Life (111 Phan Đình Phùng)
function isValidDestination(str) {
  const m = (str || '').trim().match(/^(.+?)\s*\((.+)\)$/);
  return !!m && m[1].trim().length > 0 && m[2].trim().length > 0;
}

// Kiểm tra format giờ: ddHmm (ví dụ 20h45), giờ 0-23, phút 00-59
function isValidDepartTime(t) {
  const m = (t || '').trim().match(/^([0-9]{1,2})[hH]([0-9]{2})$/);
  if (!m) return false;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

app.post('/api/partner', (req, res) => {
  const { full_name, age, phone, destination, depart_time, depart_date } = req.body;
  if (!full_name || !age || !phone || !destination || !depart_time || !depart_date) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ: họ tên, tuổi, số điện thoại, mục tiêu, giờ và ngày đi' });
  }
  // Validate format mục tiêu
  if (!isValidDestination(destination)) {
    return res.status(400).json({ error: 'Mục tiêu muốn đến phải theo format: Tên địa điểm (Số nhà Tên đường). Ví dụ: Cafe G-Life (111 Phan Đình Phùng)' });
  }
  // Validate format giờ đi
  if (!isValidDepartTime(depart_time)) {
    return res.status(400).json({ error: 'Giờ đi phải theo format: giờ + h + phút (24h). Ví dụ: 20h45, 08h30, 23h59' });
  }
  const first_name = extractFirstName(full_name);
  const info = db.prepare(`INSERT INTO find_partner
    (full_name, first_name, age, phone, destination, depart_time, depart_date)
    VALUES (?,?,?,?,?,?,?)`).run(
      full_name.trim(), first_name, Number(age), phone.trim(),
      destination.trim(), depart_time.trim(), depart_date.trim()
    );
  // Sau khi tạo, kiểm tra match tự động
  autoMatch(Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid), first_name, age: Number(age) });
});

// Danh sách người tìm bạn (chỉ hiện TÊN không họ + tuổi, ẩn họ & SĐT)
app.get('/api/partner', (req, res) => {
  const { destination } = req.query;
  let sql = 'SELECT * FROM find_partner WHERE 1=1';
  const params = [];
  if (destination && destination !== 'all') {
    sql += ' AND destination LIKE ?';
    params.push('%' + destination + '%');
  }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  // Chỉ trả về TÊN (không họ), tuổi - KHÔNG trả họ, phone
  res.json(rows.map(r => ({
    id: r.id,
    name: r.first_name,          // chỉ tên
    age: r.age,
    destination: r.destination,
    depart_time: r.depart_time,
    depart_date: r.depart_date
  })));
});

// Kiểm tra tự động match: 2 người cùng destination + depart_time + depart_date
function autoMatch(newUserId) {
  const newUser = db.prepare('SELECT * FROM find_partner WHERE id = ?').get(newUserId);
  if (!newUser) return;
  // Tìm người khác có cùng destination + depart_time + depart_date, chưa match với newUser
  const candidates = db.prepare(`
    SELECT * FROM find_partner
    WHERE id != ?
      AND destination = ?
      AND depart_time = ?
      AND depart_date = ?
    ORDER BY id ASC`).all(newUser.id, newUser.destination, newUser.depart_time, newUser.depart_date);

  for (const c of candidates) {
    // Kiểm tra chưa match
    const existing = db.prepare(`
      SELECT * FROM partner_matches
      WHERE (user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?)`).get(
        newUser.id, c.id, c.id, newUser.id
      );
    if (!existing) {
      db.prepare('INSERT INTO partner_matches (user_a_id, user_b_id) VALUES (?,?)').run(newUser.id, c.id);
    }
  }
}

// Xem thông tin chi tiết ĐẦY ĐỦ của người ĐÃ match với mình
app.get('/api/partner/:id/matches', (req, res) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT * FROM find_partner WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const matches = db.prepare(`
    SELECT m.*, 
      CASE WHEN m.user_a_id = ? THEN m.user_b_id ELSE m.user_a_id END AS other_id
    FROM partner_matches m
    WHERE m.user_a_id = ? OR m.user_b_id = ?
    ORDER BY m.created_at DESC`).all(userId, userId, userId);

  const result = matches.map(m => {
    const other = db.prepare('SELECT * FROM find_partner WHERE id = ?').get(m.other_id);
    if (!other) return null;
    // CHỈ tiết lộ đầy đủ thông tin khi đã match
    return {
      match_id: m.id,
      full_name: other.full_name,   // Họ tên đầy đủ
      age: other.age,
      phone: other.phone,           // SĐT (chỉ tiết lộ khi match)
      destination: other.destination,
      depart_time: other.depart_time,
      depart_date: other.depart_date
    };
  }).filter(Boolean);

  res.json({ user: { full_name: user.full_name }, matches: result });
});

// Xóa đăng ký tìm bạn
app.delete('/api/partner/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM find_partner WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });
  db.prepare('DELETE FROM partner_matches WHERE user_a_id = ? OR user_b_id = ?').run(req.params.id, req.params.id);
  db.prepare('DELETE FROM find_partner WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log('🍜 Foodie Map Vietnam server chạy tại http://localhost:' + PORT);
});
