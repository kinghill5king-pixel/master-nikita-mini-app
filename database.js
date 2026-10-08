const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "master-nikita.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");


/* =====================================================
   ОСНОВНЫЕ ТАБЛИЦЫ
===================================================== */

db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        city TEXT,
        address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        work_price REAL DEFAULT 0,
        materials_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        comment TEXT,
        status TEXT DEFAULT 'Новая',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (client_id)
        REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        category TEXT DEFAULT 'Другое',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL DEFAULT 0,
        comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);


/* =====================================================
   МИГРАЦИЯ СТАРОЙ БАЗЫ
===================================================== */

function addColumnIfMissing(table, column, definition) {

    const columns = db
        .prepare(`PRAGMA table_info(${table})`)
        .all();

    const exists = columns.some(
        item => item.name === column
    );

    if (!exists) {

        db.exec(`
            ALTER TABLE ${table}
            ADD COLUMN ${column} ${definition}
        `);

        console.log(
            `Добавлено поле ${table}.${column}`
        );
    }
}


addColumnIfMissing(
    "orders",
    "status",
    "TEXT DEFAULT 'Новая'"
);


/* =====================================================
   БАЗОВЫЕ УСЛУГИ
===================================================== */

const serviceCount =
    db.prepare(`
        SELECT COUNT(*) AS count
        FROM services
    `).get().count;


if (serviceCount === 0) {

    const insertService =
        db.prepare(`
            INSERT INTO services
            (name, price, category)
            VALUES (?, ?, ?)
        `);

    const services = [

        ["Муж на час", 0, "Муж на час"],
        ["Мелкий бытовой ремонт", 0, "Муж на час"],
        ["Сантехнические работы", 0, "Сантехника"],
        ["Электрика", 0, "Электрика"],
        ["Сборка и ремонт мебели", 0, "Мебель"],
        ["Повесить телевизор", 0, "Навеска"],
        ["Повесить полку", 0, "Навеска"],
        ["Повесить карниз", 0, "Навеска"],
        ["Установка люстры", 0, "Электрика"],

        ["Ремонт бытовой техники", 0, "Бытовая техника"],
        ["Ремонт стиральной машины", 0, "Бытовая техника"],
        ["Ремонт посудомоечной машины", 0, "Бытовая техника"],
        ["Ремонт духового шкафа", 0, "Бытовая техника"],
        ["Ремонт варочной панели", 0, "Бытовая техника"],
        ["Ремонт электрической плиты", 0, "Бытовая техника"],

        ["Другая работа", 0, "Другое"]

    ];

    const transaction =
        db.transaction(() => {

            for (const service of services) {
                insertService.run(...service);
            }

        });

    transaction();

}


console.log("База данных готова");

module.exports = db;