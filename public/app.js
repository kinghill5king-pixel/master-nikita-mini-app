const tg =
    window.Telegram?.WebApp;


if (tg) {

    tg.ready();

    tg.expand();

}


/* =====================================================
   СОСТОЯНИЕ
===================================================== */

let currentPage =
    "home-page";

let previousPage =
    "home-page";

let currentScheduleDate =
    getToday();

let currentOrderFilter =
    "";

let currentClientId =
    null;

let currentOrderId =
    null;


/* =====================================================
   СТАТУСЫ ЗАКАЗОВ
===================================================== */

const ORDER_STATUSES = [
    {
        value: "Новая",
        label: "Новый",
        className: "status-new",
        icon: "🟠"
    },
    {
        value: "В работе",
        label: "В работе",
        className: "status-work",
        icon: "🔵"
    },
    {
        value: "Выполнена",
        label: "Выполнен",
        className: "status-done",
        icon: "🟢"
    },
    {
        value: "Отменена",
        label: "Отменен",
        className: "status-cancel",
        icon: "🔴"
    }
];


function getStatusInfo(status) {

    return (
        ORDER_STATUSES.find(
            item => item.value === status
        ) ||
        ORDER_STATUSES[0]
    );

}


function getStatusLabel(status) {

    return getStatusInfo(status).label;

}


function getStatusIcon(status) {

    return getStatusInfo(status).icon;

}


/* =====================================================
   ДАТЫ
===================================================== */

function getToday() {

    const d =
        new Date();

    const year =
        d.getFullYear();

    const month =
        String(d.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(d.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function formatDate(date) {

    if (!date) return "";

    const parts =
        date.split("-");

    return `${parts[2]}.${parts[1]}.${parts[0]}`;

}


function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString("ru-RU")
        + " ₽";

}


/* =====================================================
   ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ
===================================================== */

function showPage(id) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.add("hidden");

        });


    const page =
        document.getElementById(id);


    if (page) {

        page.classList.remove("hidden");

    }


    currentPage = id;


    window.scrollTo({
        top: 0,
        behavior: "instant"
    });

}


/* =====================================================
   ГЛАВНАЯ
===================================================== */

async function loadDashboard() {

    try {

        const response =
            await fetch(
                `/api/dashboard?date=${getToday()}`
            );


        const data =
            await response.json();


        if (!data.success) return;


        document.getElementById(
            "home-date"
        ).textContent =
            formatDate(data.date);


        document.getElementById(
            "today-orders"
        ).textContent =
            data.stats.orders;


        document.getElementById(
            "today-revenue"
        ).textContent =
            formatMoney(
                data.stats.revenue
            );


        document.getElementById(
            "today-work"
        ).textContent =
            data.stats.inWork;


        renderNearest(
            data.nearest
        );


    } catch (error) {

        console.error(error);

    }

}


function renderNearest(order) {

    const container =
        document.getElementById(
            "nearest-order"
        );


    if (!order) {

        container.innerHTML = `

            <div class="empty-order">

                <div class="empty-icon">
                    📅
                </div>

                <div>

                    <strong>
                        Сегодня заявок нет
                    </strong>

                    <span>
                        Свободный день — можно принимать заказы
                    </span>

                </div>

            </div>

        `;

        return;

    }


    const statusInfo =
        getStatusInfo(order.status);


    container.innerHTML = `

        <div
            class="nearest-card"
            onclick="openOrder(${order.id})"
        >

            <div class="nearest-time">
                ${escapeHtml(order.time)}
            </div>

            <div class="nearest-info">

                <strong>
                    ${escapeHtml(order.name || "Клиент")}
                </strong>

                <span>
                    ${escapeHtml(order.service)}
                </span>

                <small>
                    ${escapeHtml(order.address || "Адрес не указан")}
                </small>

            </div>

            <div class="nearest-status ${statusInfo.className}">
                ${statusInfo.icon}
                ${statusInfo.label}
            </div>

            <div class="arrow">
                →
            </div>

        </div>

    `;

}


/* =====================================================
   НОВЫЙ ЗАКАЗ
===================================================== */

async function openNewOrder(clientId = null) {

    previousPage =
        currentPage;


    currentClientId =
        clientId;


    showPage(
        "new-order-page"
    );


    document.getElementById(
        "client-name"
    ).value = "";


    document.getElementById(
        "client-phone"
    ).value = "";


    document.getElementById(
        "client-city"
    ).value = "";


    document.getElementById(
        "client-address"
    ).value = "";


    document.getElementById(
        "work-price"
    ).value = "";


    document.getElementById(
        "materials-price"
    ).value = "";


    document.getElementById(
        "order-comment"
    ).value = "";


    document.getElementById(
        "order-date"
    ).value =
        getToday();


    document.getElementById(
        "order-time"
    ).value = "";


    await loadClientsForOrder();

    await loadServices();


    if (clientId) {

        await selectClient(clientId);

    }

}


function closeNewOrder() {

    showPage(
        previousPage ||
        "home-page"
    );

}


async function loadClientsForOrder() {

    try {

        const response =
            await fetch(
                "/api/clients"
            );


        const data =
            await response.json();


        const select =
            document.getElementById(
                "client-select"
            );


        select.innerHTML = `

            <option value="">
                Новый клиент
            </option>

        `;


        data.clients.forEach(client => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                client.id;


            option.textContent =
                `${client.name}${client.phone ? " — " + client.phone : ""}`;


            select.appendChild(
                option
            );

        });


        select.onchange =
            async function () {

                if (!this.value) {

                    currentClientId =
                        null;

                    return;

                }


                await selectClient(
                    Number(this.value)
                );

            };


    } catch (error) {

        console.error(error);

    }

}


async function selectClient(id) {

    currentClientId =
        id;


    const response =
        await fetch(
            `/api/clients/${id}`
        );


    const data =
        await response.json();


    if (!data.success) return;


    const client =
        data.client;


    document.getElementById(
        "client-select"
    ).value =
        client.id;


    document.getElementById(
        "client-name"
    ).value =
        client.name || "";


    document.getElementById(
        "client-phone"
    ).value =
        client.phone || "";


    document.getElementById(
        "client-city"
    ).value =
        client.city || "";


    document.getElementById(
        "client-address"
    ).value =
        client.address || "";

}


async function loadServices() {

    try {

        const response =
            await fetch(
                "/api/services"
            );


        const data =
            await response.json();


        const select =
            document.getElementById(
                "service"
            );


        select.innerHTML = `

            <option value="">
                Выберите услугу
            </option>

        `;


        data.services.forEach(service => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                service.name;


            option.textContent =
                service.name;


            select.appendChild(
                option
            );

        });


        select.onchange =
            function () {

                const selected =
                    data.services.find(
                        item =>
                            item.name ===
                            this.value
                    );


                if (
                    selected &&
                    Number(selected.price) > 0
                ) {

                    document.getElementById(
                        "work-price"
                    ).value =
                        selected.price;

                    calculateTotal();

                }

            };


    } catch (error) {

        console.error(error);

    }

}


function calculateTotal() {

    const work =
        Number(
            document.getElementById(
                "work-price"
            ).value
        ) || 0;


    const materials =
        Number(
            document.getElementById(
                "materials-price"
            ).value
        ) || 0;


    document.getElementById(
        "total-price"
    ).textContent =
        formatMoney(
            work + materials
        );

}


document.addEventListener(
    "input",
    event => {

        if (
            event.target.id ===
            "work-price" ||

            event.target.id ===
            "materials-price"
        ) {

            calculateTotal();

        }

    }
);


async function saveOrder() {

    const service =
        document.getElementById(
            "service"
        ).value;


    const date =
        document.getElementById(
            "order-date"
        ).value;


    const time =
        document.getElementById(
            "order-time"
        ).value;


    const name =
        document.getElementById(
            "client-name"
        ).value.trim();


    const phone =
        document.getElementById(
            "client-phone"
        ).value.trim();


    if (
        !service ||
        !date ||
        !time ||
        !name
    ) {

        alert(
            "Заполните клиента, услугу, дату и время"
        );

        return;

    }


    const body = {

        clientId:
            currentClientId,

        name,

        phone,

        city:
            document.getElementById(
                "client-city"
            ).value.trim(),

        address:
            document.getElementById(
                "client-address"
            ).value.trim(),

        service,

        date,

        time,

        work:
            document.getElementById(
                "work-price"
            ).value,

        materials:
            document.getElementById(
                "materials-price"
            ).value,

        comment:
            document.getElementById(
                "order-comment"
            ).value.trim()

    };


    try {

        const response =
            await fetch(
                "/api/orders",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body)

                }
            );


        const data =
            await response.json();


        if (!data.success) {

            alert(
                data.message ||
                "Ошибка"
            );

            return;

        }


        alert(
            `Заказ №${data.orderId} сохранён`
        );


        loadDashboard();

        showPage(
            "home-page"
        );


    } catch (error) {

        console.error(error);

        alert(
            "Ошибка соединения с сервером"
        );

    }

}


/* =====================================================
   РАСПИСАНИЕ
===================================================== */

async function openSchedule() {

    showPage(
        "schedule-page"
    );


    await loadSchedule();

}


async function loadSchedule() {

    document.getElementById(
        "schedule-date"
    ).textContent =
        formatDate(
            currentScheduleDate
        );


    document.getElementById(
        "schedule-day"
    ).textContent =
        currentScheduleDate === getToday()
            ? "Сегодня"
            : getWeekDay(
                currentScheduleDate
            );


    const container =
        document.getElementById(
            "schedule-list"
        );


    container.innerHTML = `
        <div class="loading">
            Загружаем...
        </div>
    `;


    try {

        const response =
            await fetch(
                `/api/orders?date=${currentScheduleDate}`
            );


        const data =
            await response.json();


        if (!data.orders.length) {

            container.innerHTML = `

                <div class="empty-block">

                    📅

                    <strong>
                        На этот день заказов нет
                    </strong>

                    <span>
                        Можно добавить новую заявку
                    </span>

                </div>

            `;

            return;

        }


        container.innerHTML =
            data.orders
                .map(
                    renderOrderCard
                )
                .join("");


    } catch (error) {

        console.error(error);

    }

}


function changeScheduleDate(days) {

    const date =
        new Date(
            currentScheduleDate +
            "T12:00:00"
        );


    date.setDate(
        date.getDate() + days
    );


    currentScheduleDate =
        date.toISOString()
            .slice(0, 10);


    loadSchedule();

}


function getWeekDay(date) {

    const days = [

        "Воскресенье",
        "Понедельник",
        "Вторник",
        "Среда",
        "Четверг",
        "Пятница",
        "Суббота"

    ];


    return days[
        new Date(
            date + "T12:00:00"
        ).getDay()
    ];

}


/* =====================================================
   ЗАКАЗЫ
===================================================== */

async function openOrders() {

    showPage(
        "orders-page"
    );


    await loadOrders();

}


function setOrderFilter(status, button = null) {

    currentOrderFilter =
        status;


    document
        .querySelectorAll(
            ".filter"
        )
        .forEach(item => {

            item.classList.remove(
                "active"
            );

        });


    if (button) {

        button.classList.add(
            "active"
        );

    }


    loadOrders();

}


async function loadOrders() {

    const search =
        document.getElementById(
            "orders-search"
        )?.value || "";


    const params =
        new URLSearchParams();


    if (search)
        params.set(
            "search",
            search
        );


    if (currentOrderFilter)
        params.set(
            "status",
            currentOrderFilter
        );


    const container =
        document.getElementById(
            "orders-page-list"
        );


    if (!container) return;


    try {

        const response =
            await fetch(
                `/api/orders?${params.toString()}`
            );


        const data =
            await response.json();


        if (!data.orders.length) {

            container.innerHTML = `

                <div class="empty-block">
                    📋
                    <strong>
                        Заказов пока нет
                    </strong>
                </div>

            `;

            return;

        }


        container.innerHTML =
            data.orders
                .map(
                    renderOrderCard
                )
                .join("");


    } catch (error) {

        console.error(error);

    }

}


function renderOrderCard(order) {

    const statusInfo =
        getStatusInfo(order.status);


    return `

        <div
            class="order-card"
            onclick="openOrder(${order.id})"
        >

            <div class="order-card-top">

                <strong>
                    ${escapeHtml(order.time)}
                </strong>

                <span
                    class="status ${statusInfo.className}"
                >
                    ${statusInfo.icon}
                    ${escapeHtml(statusInfo.label)}
                </span>

            </div>


            <div class="order-card-title">

                ${escapeHtml(
                    order.service
                )}

            </div>


            <div class="order-card-client">

                👤
                ${escapeHtml(
                    order.name || "Клиент"
                )}

            </div>


            <div class="order-card-address">

                📍
                ${escapeHtml(
                    order.address ||
                    "Адрес не указан"
                )}

            </div>


            <div class="order-card-bottom">

                <span>
                    ${formatDate(order.date)}
                </span>

                <strong>
                    ${formatMoney(order.total_price)}
                </strong>

            </div>

        </div>

    `;

}


/* =====================================================
   ОДИН ЗАКАЗ
===================================================== */

async function openOrder(id) {

    currentOrderId =
        id;


    previousPage =
        currentPage;


    showPage(
        "order-page"
    );


    const container =
        document.getElementById(
            "order-details"
        );


    container.innerHTML = `
        <div class="loading">
            Загружаем заказ...
        </div>
    `;


    try {

        const response =
            await fetch(
                `/api/orders/${id}`
            );


        const data =
            await response.json();


        if (!data.success) {

            container.innerHTML = `
                <div class="empty-block">
                    Заказ не найден
                </div>
            `;

            return;

        }


        renderOrderDetails(
            data.order
        );


    } catch (error) {

        console.error(error);

    }

}


function renderOrderDetails(order) {

    const container =
        document.getElementById(
            "order-details"
        );


    const statusInfo =
        getStatusInfo(order.status);


    const statusOptions =
        ORDER_STATUSES
            .map(
                status => `

                    <option
                        value="${escapeHtml(status.value)}"
                        ${status.value === order.status ? "selected" : ""}
                    >
                        ${status.icon} ${escapeHtml(status.label)}
                    </option>

                `
            )
            .join("");


    container.innerHTML = `

        <div class="order-detail-card">

            <div class="order-detail-service">

                ${escapeHtml(
                    order.service
                )}

            </div>


            <div class="order-detail-status">

                <select
                    id="order-status-select"
                    class="order-status-select ${statusInfo.className}"
                    onchange="changeOrderStatus(this.value)"
                >

                    ${statusOptions}

                </select>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Клиент
                </div>

                <div class="order-detail-value">
                    ${escapeHtml(
                        order.name || "—"
                    )}
                </div>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Телефон
                </div>

                <a
                    class="order-detail-phone"
                    href="tel:${escapeHtml(order.phone || "")}"
                >
                    ${escapeHtml(
                        order.phone || "—"
                    )}
                </a>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Дата
                </div>

                <div class="order-detail-value">

                    ${formatDate(order.date)}
                    в
                    ${escapeHtml(order.time)}

                </div>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Адрес
                </div>

                <div class="order-detail-value">

                    ${escapeHtml(
                        order.city || ""
                    )}

                    ${order.city && order.address ? ", " : ""}

                    ${escapeHtml(
                        order.address || ""
                    )}

                </div>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Работа
                </div>

                <div class="order-detail-value">
                    ${formatMoney(order.work_price)}
                </div>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Материалы
                </div>

                <div class="order-detail-value">
                    ${formatMoney(order.materials_price)}
                </div>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Итого
                </div>

                <div class="order-detail-price">
                    ${formatMoney(order.total_price)}
                </div>

            </div>


            <div class="order-detail-row">

                <div class="order-detail-label">
                    Комментарий
                </div>

                <div class="order-detail-value">
                    ${escapeHtml(
                        order.comment ||
                        "Нет комментария"
                    )}
                </div>

            </div>


            <div class="order-actions">

                <a
                    class="order-action-button call-client"
                    href="tel:${escapeHtml(order.phone || "")}"
                >
                    📞 Позвонить клиенту
                </a>


                <button
                    class="order-action-button secondary-button"
                    onclick="openClient(${order.client_id})"
                >
                    👤 Открыть клиента
                </button>

            </div>

        </div>

    `;

}


async function changeOrderStatus(status) {

    if (!status) return;


    const statusInfo =
        getStatusInfo(status);


    try {

        const response =
            await fetch(
                `/api/orders/${currentOrderId}/status`,
                {

                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status
                        })

                }
            );


        const data =
            await response.json();


        if (!data.success) {

            alert(
                data.message ||
                "Не удалось изменить статус"
            );

            return;

        }


        await openOrder(
            currentOrderId
        );


        loadDashboard();


    } catch (error) {

        console.error(error);

        alert(
            "Ошибка соединения с сервером"
        );

    }

}


function closeOrder() {

    showPage(
        previousPage ||
        "home-page"
    );

}


/* =====================================================
   КЛИЕНТЫ
===================================================== */

async function openClients() {

    showPage(
        "clients-page"
    );


    await loadClients();

}


async function loadClients() {

    const search =
        document.getElementById(
            "clients-search"
        )?.value || "";


    try {

        const response =
            await fetch(
                `/api/clients?search=${encodeURIComponent(search)}`
            );


        const data =
            await response.json();


        const container =
            document.getElementById(
                "clients-list"
            );


        if (!data.clients.length) {

            container.innerHTML = `

                <div class="empty-block">
                    👥
                    <strong>
                        Клиентов пока нет
                    </strong>
                </div>

            `;

            return;

        }


        container.innerHTML =
            data.clients
                .map(renderClientCard)
                .join("");


    } catch (error) {

        console.error(error);

    }

}


function renderClientCard(client) {

    const letter =
        (client.name || "?")
            .charAt(0)
            .toUpperCase();


    return `

        <div
            class="client-card"
            onclick="openClient(${client.id})"
        >

            <div class="client-avatar">
                ${escapeHtml(letter)}
            </div>


            <div class="client-main">

                <strong>
                    ${escapeHtml(client.name)}
                </strong>

                <span>
                    ${escapeHtml(
                        client.phone ||
                        "Телефон не указан"
                    )}
                </span>

                <small>
                    Заказов:
                    ${client.orders_count || 0}
                    ·
                    ${formatMoney(client.total_spent)}
                </small>

            </div>


            <div class="client-arrow">
                →
            </div>

        </div>

    `;

}


/* =====================================================
   КЛИЕНТ
===================================================== */

async function openClient(id) {

    currentClientId =
        id;


    previousPage =
        currentPage;


    showPage(
        "client-page"
    );


    const container =
        document.getElementById(
            "client-details"
        );


    container.innerHTML = `
        <div class="loading">
            Загружаем клиента...
        </div>
    `;


    try {

        const response =
            await fetch(
                `/api/clients/${id}`
            );


        const data =
            await response.json();


        if (!data.success) {

            return;

        }


        renderClientProfile(
            data.client,
            data.orders
        );


    } catch (error) {

        console.error(error);

    }

}


function renderClientProfile(
    client,
    orders
) {

    const letter =
        (client.name || "?")
            .charAt(0)
            .toUpperCase();


    const container =
        document.getElementById(
            "client-details"
        );


    container.innerHTML = `

        <div class="client-profile-card">

            <div class="client-profile-avatar">
                ${escapeHtml(letter)}
            </div>


            <h3>
                ${escapeHtml(client.name)}
            </h3>


            ${
                client.phone
                ?

                `<a
                    class="client-phone-button"
                    href="tel:${escapeHtml(client.phone)}"
                >
                    📞 ${escapeHtml(client.phone)}
                </a>`

                :

                ""
            }


            <div class="client-info-row">

                <span>
                    Город
                </span>

                <strong>
                    ${escapeHtml(
                        client.city || "—"
                    )}
                </strong>

            </div>


            <div class="client-info-row">

                <span>
                    Адрес
                </span>

                <strong>
                    ${escapeHtml(
                        client.address || "—"
                    )}
                </strong>

            </div>


            <div class="client-info-row">

                <span>
                    Клиент с
                </span>

                <strong>
                    ${formatDate(
                        client.created_at?.slice(0, 10)
                    )}
                </strong>

            </div>


            <button
                class="save-order"
                onclick="openNewOrder(${client.id})"
            >
                ＋ Новый заказ
            </button>

        </div>


        <div class="client-section-title">
            История заказов
        </div>


        ${
            orders.length

            ?

            orders
                .map(
                    order =>
                        `

                        <div
                            class="client-order-card"
                            onclick="openOrder(${order.id})"
                        >

                            <div class="client-order-top">

                                <strong>
                                    ${escapeHtml(order.service)}
                                </strong>

                                <span>
                                    ${formatDate(order.date)}
                                </span>

                            </div>


                            <div class="client-order-info">

                                ${escapeHtml(order.time)}
                                ·
                                <span class="status ${statusClass(order.status)}">
                                    ${getStatusIcon(order.status)}
                                    ${escapeHtml(getStatusLabel(order.status))}
                                </span>

                            </div>


                            <div class="client-order-price">

                                ${formatMoney(order.total_price)}

                            </div>

                        </div>

                        `
                )
                .join("")

            :

            `<div class="client-no-orders">
                У клиента пока нет заказов
            </div>`

        }

    `;

}


function closeClient() {

    showPage(
        previousPage ||
        "clients-page"
    );

}


/* =====================================================
   ФИНАНСЫ
===================================================== */

async function openFinance() {

    showPage(
        "finance-page"
    );


    const today =
        getToday();


    const month =
        today.slice(0, 7);


    document.getElementById(
        "finance-from"
    ).value =
        `${month}-01`;


    document.getElementById(
        "finance-to"
    ).value =
        today;


    document.getElementById(
        "expense-date"
    ).value =
        today;


    await loadFinance();

}


async function loadFinance() {

    const from =
        document.getElementById(
            "finance-from"
        ).value;


    const to =
        document.getElementById(
            "finance-to"
        ).value;


    try {

        const response =
            await fetch(
                `/api/finance?from=${from}&to=${to}`
            );


        const data =
            await response.json();


        const container =
            document.getElementById(
                "finance-content"
            );


        container.innerHTML = `

            <div class="finance-grid">

                <div class="finance-card">

                    <span>
                        Выполнено
                    </span>

                    <strong>
                        ${formatMoney(data.revenue)}
                    </strong>

                </div>


                <div class="finance-card">

                    <span>
                        Запланировано
                    </span>

                    <strong>
                        ${formatMoney(data.planned)}
                    </strong>

                </div>


                <div class="finance-card">

                    <span>
                        Расходы
                    </span>

                    <strong>
                        ${formatMoney(data.expenses)}
                    </strong>

                </div>


                <div class="finance-card main-finance">

                    <span>
                        Чистыми
                    </span>

                    <strong>
                        ${formatMoney(data.profit)}
                    </strong>

                </div>

            </div>


            <div class="section-title">

                <h2>
                    Расходы
                </h2>

            </div>


            ${
                data.expenseList.length

                ?

                data.expenseList
                    .map(
                        expense =>
                            `

                            <div class="expense-card">

                                <div>

                                    <strong>
                                        ${escapeHtml(
                                            expense.category
                                        )}
                                    </strong>

                                    <span>
                                        ${formatDate(
                                            expense.date
                                        )}
                                    </span>

                                </div>


                                <strong>
                                    ${formatMoney(
                                        expense.amount
                                    )}
                                </strong>

                            </div>

                            `
                    )
                    .join("")

                :

                `<div class="client-no-orders">
                    Расходов за период нет
                </div>`

            }

        `;

    } catch (error) {

        console.error(error);

    }

}


async function addExpense() {

    const body = {

        date:
            document.getElementById(
                "expense-date"
            ).value,

        category:
            document.getElementById(
                "expense-category"
            ).value.trim(),

        amount:
            document.getElementById(
                "expense-amount"
            ).value,

        comment:
            document.getElementById(
                "expense-comment"
            ).value.trim()

    };


    if (
        !body.date ||
        !body.category ||
        !body.amount
    ) {

        alert(
            "Заполните дату, категорию и сумму"
        );

        return;

    }


    const response =
        await fetch(
            "/api/expenses",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(body)

            }
        );


    const data =
        await response.json();


    if (!data.success) {

        alert(
            data.message ||
            "Ошибка"
        );

        return;

    }


    document.getElementById(
        "expense-category"
    ).value = "";


    document.getElementById(
        "expense-amount"
    ).value = "";


    document.getElementById(
        "expense-comment"
    ).value = "";


    loadFinance();

}


/* =====================================================
   УСЛУГИ
===================================================== */

async function openServices() {

    showPage(
        "services-page"
    );


    await loadServicesPage();

}


async function loadServicesPage() {

    const response =
        await fetch(
            "/api/services"
        );


    const data =
        await response.json();


    const container =
        document.getElementById(
            "services-list"
        );


    container.innerHTML =
        data.services
            .map(
                service =>
                    `

                    <div class="service-card">

                        <div>

                            <strong>
                                ${escapeHtml(service.name)}
                            </strong>

                            <span>
                                ${escapeHtml(service.category)}
                            </span>

                        </div>


                        <div class="service-price">

                            ${
                                service.price
                                ?

                                formatMoney(
                                    service.price
                                )

                                :

                                "Цена не указана"
                            }

                        </div>

                    </div>

                    `
            )
            .join("");

}


async function addService() {

    const name =
        prompt(
            "Название услуги"
        );


    if (!name) return;


    const price =
        prompt(
            "Цена, ₽",
            "0"
        );


    const category =
        prompt(
            "Категория",
            "Другое"
        );


    const response =
        await fetch(
            "/api/services",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        name,
                        price:
                            Number(price) || 0,
                        category:
                            category || "Другое"

                    })

            }
        );


    const data =
        await response.json();


    if (data.success) {

        loadServicesPage();

    }

}


/* =====================================================
   ДОМОЙ
===================================================== */

function goHome() {

    showPage(
        "home-page"
    );

    loadDashboard();

}


/* =====================================================
   HTML БЕЗОПАСНОСТЬ
===================================================== */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function statusClass(status) {

    return getStatusInfo(status).className;

}


/* =====================================================
   СТАРТ
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadDashboard();

        calculateTotal();

    }
);