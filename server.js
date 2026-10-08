const express = require("express");
const path = require("path");

const db = require("./database");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =====================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
===================================================== */

function today() {

    const date = new Date();

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function money(value) {

    return Number(value) || 0;

}


/* =====================================================
   ПРОВЕРКА
===================================================== */

app.get("/api/test", (req, res) => {

    res.json({
        success: true,
        test: 1
    });

});


/* =====================================================
   DASHBOARD
===================================================== */

app.get("/api/dashboard", (req, res) => {

    try {

        const date =
            req.query.date || today();


        const stats =
            db.prepare(`
                SELECT

                    COUNT(*) AS orders_count,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN status = 'Выполнена'
                                THEN total_price
                                ELSE 0
                            END
                        ),
                        0
                    ) AS revenue,

                    SUM(
                        CASE
                            WHEN status = 'В работе'
                            THEN 1
                            ELSE 0
                        END
                    ) AS in_work

                FROM orders

                WHERE date = ?
            `).get(date);


        const nearest =
            db.prepare(`
                SELECT

                    orders.*,

                    clients.name,
                    clients.phone,
                    clients.city,
                    clients.address

                FROM orders

                LEFT JOIN clients
                    ON clients.id =
                       orders.client_id

                WHERE orders.date = ?

                ORDER BY orders.time ASC

                LIMIT 1
            `).get(date);


        res.json({

            success: true,

            date,

            stats: {

                orders:
                    stats.orders_count || 0,

                revenue:
                    stats.revenue || 0,

                inWork:
                    stats.in_work || 0

            },

            nearest:
                nearest || null

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка загрузки главной"

        });

    }

});


/* =====================================================
   СОЗДАНИЕ ЗАКАЗА
===================================================== */

app.post("/api/orders", (req, res) => {

    try {

        const {

            clientId,

            name,
            phone,
            city,
            address,

            service,

            date,
            time,

            work,
            materials,

            comment

        } = req.body;


        if (
            !service ||
            !date ||
            !time
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Укажите услугу, дату и время"

            });

        }


        let finalClientId =
            Number(clientId) || null;


        /* =================================================
           ЕСЛИ КЛИЕНТ НЕ ВЫБРАН — ИЩЕМ ПО ТЕЛЕФОНУ
        ================================================= */

        if (!finalClientId && phone) {

            const existingClient =
                db.prepare(`
                    SELECT id
                    FROM clients
                    WHERE phone = ?
                    LIMIT 1
                `).get(
                    String(phone).trim()
                );


            if (existingClient) {

                finalClientId =
                    existingClient.id;

            }

        }


        /* =================================================
           СОЗДАЁМ НОВОГО КЛИЕНТА
        ================================================= */

        if (!finalClientId) {

            if (!name) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Укажите имя клиента"

                });

            }


            const clientResult =
                db.prepare(`
                    INSERT INTO clients
                    (
                        name,
                        phone,
                        city,
                        address
                    )

                    VALUES (?, ?, ?, ?)
                `).run(

                    name,
                    phone || "",
                    city || "",
                    address || ""

                );


            finalClientId =
                clientResult.lastInsertRowid;

        }


        /* =================================================
           ЕСЛИ КЛИЕНТ УЖЕ ЕСТЬ — ОБНОВЛЯЕМ ДАННЫЕ
        ================================================= */

        else {

            db.prepare(`
                UPDATE clients

                SET

                    name = ?,
                    phone = ?,
                    city = ?,
                    address = ?

                WHERE id = ?
            `).run(

                name || "",
                phone || "",
                city || "",
                address || "",

                finalClientId

            );

        }


        const workPrice =
            money(work);

        const materialsPrice =
            money(materials);

        const totalPrice =
            workPrice +
            materialsPrice;


        const orderResult =
            db.prepare(`
                INSERT INTO orders

                (
                    client_id,
                    service,
                    date,
                    time,
                    work_price,
                    materials_price,
                    total_price,
                    comment,
                    status
                )

                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(

                finalClientId,

                service,

                date,
                time,

                workPrice,
                materialsPrice,
                totalPrice,

                comment || "",

                "Новая"

            );


        res.json({

            success: true,

            orderId:
                orderResult.lastInsertRowid,

            clientId:
                finalClientId,

            total:
                totalPrice

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка при сохранении заказа"

        });

    }

});


/* =====================================================
   СПИСОК ЗАКАЗОВ
===================================================== */

app.get("/api/orders", (req, res) => {

    try {

        const {

            date,
            status,
            search

        } = req.query;


        let sql = `

            SELECT

                orders.id,
                orders.client_id,
                orders.service,
                orders.date,
                orders.time,

                orders.work_price,
                orders.materials_price,
                orders.total_price,

                orders.comment,
                orders.status,

                clients.name,
                clients.phone,
                clients.city,
                clients.address

            FROM orders

            LEFT JOIN clients
                ON clients.id =
                   orders.client_id

            WHERE 1 = 1

        `;


        const params = [];


        if (date) {

            sql += `
                AND orders.date = ?
            `;

            params.push(date);

        }


        if (status) {

            sql += `
                AND orders.status = ?
            `;

            params.push(status);

        }


        if (search) {

            sql += `

                AND (

                    clients.name LIKE ?
                    OR clients.phone LIKE ?
                    OR clients.address LIKE ?
                    OR orders.service LIKE ?

                )

            `;

            const value =
                `%${search}%`;

            params.push(
                value,
                value,
                value,
                value
            );

        }


        sql += `

            ORDER BY

                orders.date DESC,
                orders.time ASC

        `;


        const orders =
            db.prepare(sql).all(...params);


        res.json({

            success: true,

            orders

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Не удалось загрузить заказы"

        });

    }

});


/* =====================================================
   ОДИН ЗАКАЗ
===================================================== */

app.get("/api/orders/:id", (req, res) => {

    try {

        const id =
            Number(req.params.id);


        const order =
            db.prepare(`

                SELECT

                    orders.*,

                    clients.name,
                    clients.phone,
                    clients.city,
                    clients.address

                FROM orders

                LEFT JOIN clients
                    ON clients.id =
                       orders.client_id

                WHERE orders.id = ?

            `).get(id);


        if (!order) {

            return res.status(404).json({

                success: false,

                message:
                    "Заказ не найден"

            });

        }


        res.json({

            success: true,

            order

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка загрузки заказа"

        });

    }

});


/* =====================================================
   СТАТУС ЗАКАЗА
===================================================== */

app.patch(
    "/api/orders/:id/status",
    (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const { status } =
                req.body;


            const statuses = [

                "Новая",
                "В работе",
                "Выполнена",
                "Отменена"

            ];


            if (
                !statuses.includes(status)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Недопустимый статус"

                });

            }


            const result =
                db.prepare(`

                    UPDATE orders

                    SET status = ?

                    WHERE id = ?

                `).run(

                    status,
                    id

                );


            if (!result.changes) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Заказ не найден"

                });

            }


            res.json({

                success: true,

                status

            });


        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Ошибка изменения статуса"

            });

        }

    }
);


/* =====================================================
   КЛИЕНТЫ
===================================================== */

app.get("/api/clients", (req, res) => {

    try {

        const search =
            String(
                req.query.search || ""
            ).trim();


        let sql = `

            SELECT

                clients.*,

                COUNT(orders.id)
                    AS orders_count,

                COALESCE(
                    SUM(
                        CASE
                            WHEN orders.status = 'Выполнена'
                            THEN orders.total_price
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_spent

            FROM clients

            LEFT JOIN orders
                ON orders.client_id =
                   clients.id

        `;


        const params = [];


        if (search) {

            sql += `

                WHERE

                    clients.name LIKE ?
                    OR clients.phone LIKE ?
                    OR clients.city LIKE ?
                    OR clients.address LIKE ?

            `;

            const value =
                `%${search}%`;

            params.push(
                value,
                value,
                value,
                value
            );

        }


        sql += `

            GROUP BY clients.id

            ORDER BY clients.name ASC

        `;


        const clients =
            db.prepare(sql).all(...params);


        res.json({

            success: true,

            clients

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Не удалось загрузить клиентов"

        });

    }

});


/* =====================================================
   ОДИН КЛИЕНТ
===================================================== */

app.get("/api/clients/:id", (req, res) => {

    try {

        const id =
            Number(req.params.id);


        const client =
            db.prepare(`

                SELECT *

                FROM clients

                WHERE id = ?

            `).get(id);


        if (!client) {

            return res.status(404).json({

                success: false,

                message:
                    "Клиент не найден"

            });

        }


        const orders =
            db.prepare(`

                SELECT *

                FROM orders

                WHERE client_id = ?

                ORDER BY date DESC, time DESC

            `).all(id);


        res.json({

            success: true,

            client,
            orders

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка загрузки клиента"

        });

    }

});


/* =====================================================
   ИЗМЕНЕНИЕ КЛИЕНТА
===================================================== */

app.patch("/api/clients/:id", (req, res) => {

    try {

        const id =
            Number(req.params.id);

        const {

            name,
            phone,
            city,
            address

        } = req.body;


        if (!name) {

            return res.status(400).json({

                success: false,

                message:
                    "Имя клиента обязательно"

            });

        }


        const result =
            db.prepare(`

                UPDATE clients

                SET

                    name = ?,
                    phone = ?,
                    city = ?,
                    address = ?

                WHERE id = ?

            `).run(

                name,
                phone || "",
                city || "",
                address || "",

                id

            );


        if (!result.changes) {

            return res.status(404).json({

                success: false,

                message:
                    "Клиент не найден"

            });

        }


        res.json({

            success: true

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Не удалось изменить клиента"

        });

    }

});


/* =====================================================
   УСЛУГИ
===================================================== */

app.get("/api/services", (req, res) => {

    try {

        const services =
            db.prepare(`

                SELECT *

                FROM services

                WHERE active = 1

                ORDER BY category, name

            `).all();


        res.json({

            success: true,

            services

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Не удалось загрузить услуги"

        });

    }

});


app.post("/api/services", (req, res) => {

    try {

        const {

            name,
            price,
            category

        } = req.body;


        if (!name) {

            return res.status(400).json({

                success: false,

                message:
                    "Укажите название услуги"

            });

        }


        const result =
            db.prepare(`

                INSERT INTO services
                (name, price, category)

                VALUES (?, ?, ?)

            `).run(

                name,
                money(price),
                category || "Другое"

            );


        res.json({

            success: true,

            id:
                result.lastInsertRowid

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка создания услуги"

        });

    }

});


app.patch("/api/services/:id", (req, res) => {

    try {

        const id =
            Number(req.params.id);

        const {

            name,
            price,
            category

        } = req.body;


        db.prepare(`

            UPDATE services

            SET

                name = ?,
                price = ?,
                category = ?

            WHERE id = ?

        `).run(

            name,
            money(price),
            category || "Другое",

            id

        );


        res.json({

            success: true

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка изменения услуги"

        });

    }

});


app.delete("/api/services/:id", (req, res) => {

    try {

        const id =
            Number(req.params.id);


        db.prepare(`

            UPDATE services

            SET active = 0

            WHERE id = ?

        `).run(id);


        res.json({

            success: true

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка удаления услуги"

        });

    }

});


/* =====================================================
   ФИНАНСЫ
===================================================== */

app.get("/api/finance", (req, res) => {

    try {

        const from =
            req.query.from ||
            `${today().slice(0, 7)}-01`;

        const to =
            req.query.to ||
            today();


        const revenue =
            db.prepare(`

                SELECT

                    COALESCE(
                        SUM(total_price),
                        0
                    ) AS total

                FROM orders

                WHERE

                    date BETWEEN ?
                    AND ?

                    AND status = 'Выполнена'

            `).get(from, to);


        const planned =
            db.prepare(`

                SELECT

                    COALESCE(
                        SUM(total_price),
                        0
                    ) AS total

                FROM orders

                WHERE

                    date BETWEEN ?
                    AND ?

                    AND status != 'Отменена'

            `).get(from, to);


        const expenses =
            db.prepare(`

                SELECT

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total

                FROM expenses

                WHERE date BETWEEN ? AND ?

            `).get(from, to);


        const expenseList =
            db.prepare(`

                SELECT *

                FROM expenses

                WHERE date BETWEEN ? AND ?

                ORDER BY date DESC, id DESC

            `).all(from, to);


        res.json({

            success: true,

            from,
            to,

            revenue:
                revenue.total || 0,

            planned:
                planned.total || 0,

            expenses:
                expenses.total || 0,

            profit:
                (revenue.total || 0) -
                (expenses.total || 0),

            expenseList

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка загрузки финансов"

        });

    }

});


/* =====================================================
   ДОБАВЛЕНИЕ РАСХОДА
===================================================== */

app.post("/api/expenses", (req, res) => {

    try {

        const {

            date,
            category,
            amount,
            comment

        } = req.body;


        if (
            !date ||
            !category ||
            !amount
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Заполните дату, категорию и сумму"

            });

        }


        const result =
            db.prepare(`

                INSERT INTO expenses

                (
                    date,
                    category,
                    amount,
                    comment
                )

                VALUES (?, ?, ?, ?)

            `).run(

                date,
                category,
                money(amount),
                comment || ""

            );


        res.json({

            success: true,

            id:
                result.lastInsertRowid

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка добавления расхода"

        });

    }

});


/* =====================================================
   УДАЛЕНИЕ РАСХОДА
===================================================== */

app.delete("/api/expenses/:id", (req, res) => {

    try {

        const id =
            Number(req.params.id);


        db.prepare(`

            DELETE FROM expenses

            WHERE id = ?

        `).run(id);


        res.json({

            success: true

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Ошибка удаления расхода"

        });

    }

});


/* =====================================================
   ЗАПУСК
===================================================== */

app.listen(PORT, () => {

    console.log(
        `Mini App запущен: http://localhost:${PORT}`
    );

});