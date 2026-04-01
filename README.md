# ServIQ

Платформа для навчання і перевірки персоналу сфери гостинності. У проєкті є:

- конструктор сервірування столу
- візуальний редактор сценаріїв
- конструктор квізів
- комплексні тести
- студентські публічні сторінки за `hash`-посиланнями
- адмін-панель з ролями, результатами і статистикою

## Стек

- `client/` — React 18 + React Router 7 + CRA
- `server/` — Node.js + Express + Mongoose + Socket.IO
- База даних — MongoDB

## Швидкий старт

### 1. Встановлення

```bash
npm run install-all
```

### 2. Налаштування `server/.env`

```env
MONGODB_URI=mongodb://localhost:27017/serviq
PORT=5000
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=8h
GROQ_API_KEY=
```

### 3. Запуск

Увесь стек:

```bash
npm run dev
```

Окремо:

```bash
npm run server
npm run client
```

Frontend за замовчуванням працює на `http://localhost:3000`, backend — на `http://localhost:5000`.

## Корисні команди

```bash
npm run build
npm run seed:game
npm run test:server
npm run test:client
```

## Ролі

- `superadmin` — повний доступ
- `admin` — свої шаблони, тести, редактори і результати
- `trainer` — сценарії, квізи і перегляд результатів
- `viewer` — лише результати
- `localadmin` — лише аналітика трафіку

## Основні маршрути

Публічні:

- `/test/:hash`
- `/multi-test/:hash`
- `/game/:hash`
- `/quiz/:hash`
- `/complex/:hash`

Адмінські:

- `/virtual-desk`
- `/visual-builder`
- `/quiz-builder`
- `/complex-builder`
- `/test-results`
- `/students`
- `/settings`
- `/users`
- `/cities`
- `/analytics`

## Backend-модулі

- `server/routes/tests.js` — desk і multi-desk тести
- `server/routes/game.js` — сценарії, посилання і результати гри
- `server/routes/quiz.js` — квізи, посилання і результати
- `server/routes/complexTest.js` — комплексні тести
- `server/routes/templates.js` — шаблони сервірування
- `server/routes/testResults.js` — результати сервірування
- `server/routes/student.js` — профілі студентів
- `server/routes/maintenance.js` — скидання результатів

## Тестування

Server suite:

```bash
cd server
npm test
```

Client production build:

```bash
cd client
npm run build
```

## Примітки

- Публічні студентські сторінки не повинні залежати від авторизованих API.
- Рольова і міська ізоляція реалізовані на бекенді, а не лише в UI.
- Для першого запуску на порожній базі можна використати `POST /api/auth/register-root`.
