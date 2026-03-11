# ServIQ — Платформа навчання персоналу

Платформа для інтерактивного навчання та тестування персоналу у сфері гостинності. Включає конструктори сервірування, ігрових сценаріїв та квізів.

## 🚀 Швидкий запуск

### 1. Передумови
- **Node.js** (v18+)
- **MongoDB** (локально або MongoDB Atlas)

### 2. Встановлення
Виконайте команду в коріні проекту для встановлення всіх залежностей (корінь, сервер, клієнт):
```bash
npm run install-all
```

### 3. Налаштування середовища
Створіть файл `server/.env` (якщо його немає) та налаштуйте змінні:
```env
MONGODB_URI=mongodb://localhost:27017/serviq
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=8h
```

### 4. Запуск проекту
Для запуску сервера та клієнта одночасно:
```bash
npm run dev
```
- Клієнт: [http://localhost:3000](http://localhost:3000)
- Сервер: [http://localhost:5000](http://localhost:5000)

---

## 🛠 Команди

| Команда | Опис |
|---------|------|
| `npm run dev` | Запуск клієнта та сервера одночасно |
| `npm run install-all` | Встановлення залежностей для всього проекту |
| `npm run server` | Запуск лише сервера (з nodemon) |
| `npm run client` | Запуск лише клієнта |
| `npm run seed:game` | Завантаження базового ігрового сценарію |

---

## 🏗 Структура проекту
- `/client` — React додаток (Frontend)
- `/server` — Node.js / Express API (Backend)
- `/server/models` — Схеми бази даних MongoDB
- `/server/tests` — Автоматичні тести (Jest)

## 🧪 Тестування
Для запуску тестів бекенду:
```bash
cd server
npm test
```

---
© 2026 ServIQ Team
