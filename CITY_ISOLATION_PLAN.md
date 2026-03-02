# 🏙️ Ізоляція Даних по Містах

> **Вимога:** Кожне з 13 міст бачить тільки свої дані

---

## 📊 Поточний Статус

### ✅ Вже реалізовано

| Компонент | Статус | Примітки |
|-----------|--------|----------|
| Фільтр по містах в Dashboard | ✅ | Superadmin бачить всі |
| Фільтр в TestResults | ✅ | Admin бачить тільки своє місто |
| Ролі користувачів | ✅ | superadmin/admin/trainer/viewer |
| Прив'язка користувача до міста | ✅ | Поле `city` в User |

### ⚠️ Потрібно доопрацювати

| API Endpoint | Проблема | Рішення |
|--------------|----------|---------|
| `/api/templates` | Всі бачать всі шаблони | Додати фільтр по city |
| `/api/game-scenarios` | Всі бачать всі сценарії | Додати фільтр по city |
| `/api/quiz` | Всі бачать всі квізи | Додати фільтр по city |
| `/api/tests` | Всі бачать всі тести | Додати фільтр по city |
| `/api/complex-tests` | Всі бачать всі тести | Додати фільтр по city |

---

## 🛠️ План Реалізації

### Крок 1: Додати middleware для фільтрації по містах

**Файл:** `server/middleware/cityFilter.js`

```javascript
const cityFilter = (modelName, fieldName = 'city') => {
    return async (req, res, next) => {
        // Superadmin бачить все
        if (req.user.role === 'superadmin') {
            return next();
        }
        
        // Admin/Trainer/Viewer бачать тільки своє місто
        if (req.user.city) {
            req.query = req.query || {};
            req.query[fieldName] = req.user.city;
        }
        
        next();
    };
};

module.exports = cityFilter;
```

---

### Крок 2: Оновити маршрути

#### Templates (`/api/templates`)

```javascript
// server/routes/templates.js
const cityFilter = require('../middleware/cityFilter');

// GET /api/templates
router.get('/', auth, cityFilter('DeskTemplate', 'city'), async (req, res) => {
    const templates = await DeskTemplate.find(req.query);
    res.json(templates);
});

// POST /api/templates
router.post('/', auth, checkRole(['superadmin', 'admin']), async (req, res) => {
    const template = await DeskTemplate.create({
        ...req.body,
        city: req.user.role === 'superadmin' 
            ? req.body.city 
            : req.user.city  // Автоматично прив'язуємо до міста
    });
    res.status(201).json(template);
});
```

#### Game Scenarios (`/api/game-scenarios`)

```javascript
// server/routes/game.js
const cityFilter = require('../middleware/cityFilter');

// GET /api/game-scenarios
router.get('/', auth, cityFilter('GameScenario', 'targetCity'), async (req, res) => {
    const scenarios = await GameScenario.find(req.query);
    res.json(scenarios);
});

// POST /api/game-scenarios
router.post('/', auth, checkRole(['superadmin', 'admin']), async (req, res) => {
    const scenario = await GameScenario.create({
        ...req.body,
        targetCity: req.user.role === 'superadmin' 
            ? req.body.targetCity 
            : req.user.city
    });
    res.status(201).json(scenario);
});
```

#### Quiz (`/api/quiz`)

```javascript
// server/routes/quiz.js
const cityFilter = require('../middleware/cityFilter');

// GET /api/quiz
router.get('/', auth, cityFilter('Quiz', 'city'), async (req, res) => {
    const quizzes = await Quiz.find(req.query);
    res.json(quizzes);
});

// POST /api/quiz
router.post('/', auth, checkRole(['superadmin', 'admin', 'trainer']), async (req, res) => {
    const quiz = await Quiz.create({
        ...req.body,
        city: req.user.role === 'superadmin' 
            ? req.body.city 
            : req.user.city
    });
    res.status(201).json(quiz);
});
```

---

### Крок 3: Оновити моделі

Додати поле `city` або `targetCity` до всіх моделей:

```javascript
// models/DeskTemplate.js
const deskTemplateSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    city: { type: String, default: '' },  // ← Додати
    items: [...],
    createdAt: { type: Date, default: Date.now }
});

// models/GameScenario.js
const gameScenarioSchema = new mongoose.Schema({
    title: { type: String, required: true },
    targetCity: { type: String, default: '' },  // ← Додати
    startNodeId: { type: String },
    nodes: [...],
    createdAt: { type: Date, default: Date.now }
});

// models/Quiz.js
const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    city: { type: String, default: '' },  // ← Додати
    questions: [...],
    createdAt: { type: Date, default: Date.now }
});
```

---

### Крок 4: Оновити Dashboard

Dashboard вже має фільтр по містах для Superadmin. Потрібно переконатися, що:

1. **Superadmin** — бачить всі міста + фільтр
2. **Admin/Trainer/Viewer** — бачать тільки своє місто (без фільтру)

```javascript
// client/src/components/Dashboard.js
const isAdminCityOnly = user?.role !== 'superadmin' && user?.city;

// Вже реалізовано ✅
```

---

### Крок 5: Тести

Створити тести для перевірки ізоляції:

```javascript
// tests/city-isolation.test.js

describe('City Isolation', () => {
    it('should only see templates from own city', async () => {
        // Admin з Хмельницького
        const res = await request(app)
            .get('/api/templates')
            .set('Authorization', 'Bearer khmelnytskyi-admin-token');
        
        expect(res.body.every(t => t.city === 'Хмельницький')).toBe(true);
    });
    
    it('superadmin should see all cities', async () => {
        const res = await request(app)
            .get('/api/templates')
            .set('Authorization', 'Bearer superadmin-token');
        
        const cities = [...new Set(res.body.map(t => t.city))];
        expect(cities.length).toBeGreaterThan(1);
    });
});
```

---

## 📋 Чек-лист Реалізації

### Backend

- [ ] Створити `middleware/cityFilter.js`
- [ ] Оновити `/api/templates`
- [ ] Оновити `/api/game-scenarios`
- [ ] Оновити `/api/quiz`
- [ ] Оновити `/api/tests`
- [ ] Оновити `/api/complex-tests`
- [ ] Додати поле `city` до моделей
- [ ] Створити міграцію для існуючих даних

### Frontend

- [ ] Перевірити Dashboard (вже готово ✅)
- [ ] Перевірити TestResults (вже готово ✅)
- [ ] Оновити форми створення (авто-вибір міста)
- [ ] Приховати фільтр міста для не-superadmin

### Тести

- [ ] Unit-тести для middleware
- [ ] E2E тести для ізоляції
- [ ] Перевірити всі API endpoints

---

## ⏱️ Оцінка Часу

| Задача | Оцінка |
|--------|--------|
| Middleware | 2г |
| Оновлення маршрутів (5 шт) | 3г |
| Оновлення моделей (5 шт) | 2г |
| Міграція даних | 1г |
| Frontend правки | 2г |
| Тести | 2г |
| **Разом** | **12 годин** |

---

## 🔒 Безпека

### Важливо!

1. **Ніколи не довіряти client-side фільтрації**
   - Тільки серверна перевірка
   - Middleware повинен бути обов'язковим

2. **Перевіряти city у всіх запитах**
   - Навіть якщо користувач має токен
   - Навіть для GET запитів

3. **Логування спроб доступу**
   - Записувати всі спроти доступу до чужих даних
   - Alert при підозрілій активності

---

## 📊 Матриця Доступу

| Роль | Своє місто | Всі міста | Створення | Видалення |
|------|------------|-----------|-----------|-----------|
| **Superadmin** | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ❌ | ✅ | ❌ |
| **Trainer** | ✅ | ❌ | ✅ | ❌ |
| **Viewer** | ✅ (тільки перегляд) | ❌ | ❌ | ❌ |

---

*Документ для реалізації ізоляції по містах*
