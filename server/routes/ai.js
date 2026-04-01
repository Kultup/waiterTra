const express = require('express');
const Groq = require('groq-sdk');
const { auth } = require('../middleware/authMiddleware');
const { buildResultFilter } = require('../utils/platformFilter');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');

const router = express.Router();

let groqClient = null;

function getGroq() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

function buildScopedFilter(baseFilter, dateFilter, cityField, city) {
    const conditions = [];

    if (dateFilter.completedAt) {
        conditions.push({ completedAt: dateFilter.completedAt });
    }

    if (baseFilter && Object.keys(baseFilter).length > 0) {
        conditions.push(baseFilter);
    }

    if (city) {
        conditions.push({ [cityField]: city });
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
}

function isPassed(result) {
    if (typeof result?.passed === 'boolean') return result.passed;
    if (typeof result?.isWin === 'boolean') return result.isWin;
    if (typeof result?.overallPassed === 'boolean') return result.overallPassed;
    if (typeof result?.percentage === 'number') return result.percentage >= 80;
    return false;
}

function successRate(passed, total) {
    return total > 0 ? Math.round((passed / total) * 100) : 0;
}

function sortByRateAndCount(items, rateKey) {
    return [...items].sort((left, right) =>
        (right[rateKey] - left[rateKey]) || (right.count - left.count) || left.name.localeCompare(right.name)
    );
}

function summarizeBuckets(bucketMap, rateKey) {
    return sortByRateAndCount(
        Object.entries(bucketMap).map(([name, data]) => ({
            name,
            count: data.count,
            passed: data.passed,
            failed: data.count - data.passed,
            [rateKey]: successRate(data.passed, data.count)
        })),
        rateKey
    );
}

router.post('/analyze', auth, async (req, res) => {
    if (!getGroq()) {
        return res.status(500).json({ error: 'GROQ_API_KEY не налаштовано' });
    }

    const { mode, city, days, tab } = req.body;

    try {
        const dateFilter = {};
        if (days && days > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            dateFilter.completedAt = { $gte: cutoff };
        }

        const [deskBaseFilter, gameBaseFilter, quizBaseFilter, complexBaseFilter] = await Promise.all([
            buildResultFilter(req.user, 'studentCity'),
            buildResultFilter(req.user, 'city'),
            buildResultFilter(req.user, 'studentCity'),
            buildResultFilter(req.user, 'studentCity')
        ]);

        const deskFilter = buildScopedFilter(deskBaseFilter, dateFilter, 'studentCity', city);
        const gameFilter = buildScopedFilter(gameBaseFilter, dateFilter, 'city', city);
        const quizFilter = buildScopedFilter(quizBaseFilter, dateFilter, 'studentCity', city);
        const complexFilter = buildScopedFilter(complexBaseFilter, dateFilter, 'studentCity', city);

        const fetchTypes = tab && tab !== 'all'
            ? [tab]
            : ['desk', 'game', 'quiz', 'complex'];

        const results = {};
        if (fetchTypes.includes('desk')) {
            results.desk = await TestResult.find(deskFilter).sort({ completedAt: -1 }).limit(200).lean();
        }
        if (fetchTypes.includes('game')) {
            results.game = await GameResult.find(gameFilter).sort({ completedAt: -1 }).limit(200).lean();
        }
        if (fetchTypes.includes('quiz')) {
            results.quiz = await QuizResult.find(quizFilter).sort({ completedAt: -1 }).limit(200).lean();
        }
        if (fetchTypes.includes('complex')) {
            results.complex = await ComplexTestResult.find(complexFilter).sort({ completedAt: -1 }).limit(200).lean();
        }

        const summary = buildSummary(results);

        if (summary.totalResults === 0) {
            return res.json({
                analysis: 'Недостатньо даних для аналізу. Спробуйте розширити період або змінити фільтри.'
            });
        }

        const prompt = buildPrompt(summary, mode, city, days);

        const chatCompletion = await getGroq().chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Ти — сильний AI-аналітик навчальної платформи для персоналу ресторанів та готелів. Відповідай тільки українською мовою. Аналізуй лише ті дані, які явно передані в prompt, нічого не вигадуй і не приписуй причин без опори на цифри. Завжди спирайся на конкретні числа, відсотки, динаміку, вибірки та порівняння. Якщо даних недостатньо або вибірка замала, прямо скажи про це. Пиши по-діловому, стисло, практично і без води. Структуруй відповідь короткими розділами з emoji, не використовуй таблиці, не дублюй одні й ті самі висновки різними словами. Рекомендації мають бути конкретними, пріоритезованими і прив’язаними до проблемного модуля, міста, посади або сценарію.'
                },
                { role: 'user', content: prompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.35,
            max_tokens: 2000
        });

        const analysis = chatCompletion.choices[0]?.message?.content || 'Не вдалося отримати аналіз';
        res.json({ analysis });
    } catch (err) {
        console.error('AI analyze error:', err);
        res.status(500).json({ error: err.message || 'Помилка AI аналізу' });
    }
});

function buildSummary(results) {
    const summary = {
        totalResults: 0,
        byType: {},
        byCityMap: {},
        byPosition: {},
        timeline: {},
        strongestCities: [],
        weakestCities: [],
        strongestPositions: [],
        weakestPositions: []
    };

    if (results.desk?.length) {
        const items = results.desk;
        summary.totalResults += items.length;
        const passed = items.filter((result) => result.passed).length;
        const avg = Math.round(items.reduce((sum, result) => sum + (result.percentage || 0), 0) / items.length);
        summary.byType.desk = { count: items.length, passed, failed: items.length - passed, avg };

        const byTemplate = {};
        items.forEach((result) => {
            const key = result.templateName || 'Без назви';
            if (!byTemplate[key]) byTemplate[key] = { count: 0, passed: 0, totalPct: 0 };
            byTemplate[key].count += 1;
            if (result.passed) byTemplate[key].passed += 1;
            byTemplate[key].totalPct += result.percentage || 0;
        });

        summary.byType.desk.byTemplate = Object.entries(byTemplate)
            .map(([name, data]) => ({
                name,
                count: data.count,
                passed: data.passed,
                avg: Math.round(data.totalPct / data.count)
            }))
            .sort((left, right) => left.avg - right.avg || right.count - left.count);

        aggregateByCityAndPosition(items, summary, 'studentCity', 'studentPosition');
    }

    if (results.game?.length) {
        const items = results.game;
        summary.totalResults += items.length;
        const wins = items.filter((result) => result.isWin).length;
        summary.byType.game = {
            count: items.length,
            wins,
            losses: items.length - wins,
            winRate: successRate(wins, items.length)
        };

        const byScenario = {};
        items.forEach((result) => {
            const key = result.scenarioTitle || 'Без назви';
            if (!byScenario[key]) byScenario[key] = { count: 0, wins: 0 };
            byScenario[key].count += 1;
            if (result.isWin) byScenario[key].wins += 1;
        });

        summary.byType.game.byScenario = Object.entries(byScenario)
            .map(([name, data]) => ({
                name,
                count: data.count,
                wins: data.wins,
                winRate: successRate(data.wins, data.count)
            }))
            .sort((left, right) => left.winRate - right.winRate || right.count - left.count);

        aggregateByCityAndPosition(items, summary, 'city', 'position', 'playerCity', 'playerPosition');
    }

    if (results.quiz?.length) {
        const items = results.quiz;
        summary.totalResults += items.length;
        const passed = items.filter((result) => result.percentage >= 80).length;
        const avg = Math.round(items.reduce((sum, result) => sum + (result.percentage || 0), 0) / items.length);
        summary.byType.quiz = { count: items.length, passed, failed: items.length - passed, avg };

        aggregateByCityAndPosition(items, summary, 'studentCity', 'studentPosition');
    }

    if (results.complex?.length) {
        const items = results.complex;
        summary.totalResults += items.length;
        const passed = items.filter((result) => result.overallPassed).length;
        summary.byType.complex = { count: items.length, passed, failed: items.length - passed };

        aggregateByCityAndPosition(items, summary, 'studentCity', 'studentPosition');
    }

    const allItems = [
        ...(results.desk || []).map((result) => ({ date: result.completedAt, passed: result.passed })),
        ...(results.game || []).map((result) => ({ date: result.completedAt, passed: result.isWin })),
        ...(results.quiz || []).map((result) => ({ date: result.completedAt, passed: result.percentage >= 80 })),
        ...(results.complex || []).map((result) => ({ date: result.completedAt, passed: result.overallPassed }))
    ];

    allItems.forEach((result) => {
        const day = new Date(result.date).toISOString().split('T')[0];
        if (!summary.timeline[day]) summary.timeline[day] = { passed: 0, failed: 0 };
        if (result.passed) summary.timeline[day].passed += 1;
        else summary.timeline[day].failed += 1;
    });

    const cityStats = summarizeBuckets(summary.byCityMap, 'successRate');
    const positionStats = summarizeBuckets(summary.byPosition, 'successRate');
    summary.strongestCities = cityStats.filter((entry) => entry.count >= 2).slice(0, 3);
    summary.weakestCities = [...cityStats].reverse().filter((entry) => entry.count >= 2).slice(0, 3);
    summary.strongestPositions = positionStats.filter((entry) => entry.count >= 2).slice(0, 3);
    summary.weakestPositions = [...positionStats].reverse().filter((entry) => entry.count >= 2).slice(0, 3);

    return summary;
}

function aggregateByCityAndPosition(items, summary, cityField, posField, altCityField, altPosField) {
    items.forEach((result) => {
        const city = result[cityField] || (altCityField && result[altCityField]) || 'Невідомо';
        const position = result[posField] || (altPosField && result[altPosField]) || 'Невідомо';

        if (!summary.byCityMap[city]) summary.byCityMap[city] = { count: 0, passed: 0 };
        summary.byCityMap[city].count += 1;
        if (isPassed(result)) {
            summary.byCityMap[city].passed += 1;
        }

        if (!summary.byPosition[position]) summary.byPosition[position] = { count: 0, passed: 0 };
        summary.byPosition[position].count += 1;
        if (isPassed(result)) {
            summary.byPosition[position].passed += 1;
        }
    });
}

function buildPrompt(summary, mode, city, days) {
    const periodText = days ? `за останні ${days} днів` : 'за весь час';
    const cityText = city ? ` по місту ${city}` : '';

    let prompt = `Проаналізуй результати навчання персоналу ресторанів${cityText} ${periodText}.\n\n`;
    prompt += `ЗАГАЛОМ: ${summary.totalResults} результатів.\n\n`;

    if (summary.byType.desk) {
        const desk = summary.byType.desk;
        prompt += `СЕРВІРУВАННЯ СТОЛУ: ${desk.count} тестів, ${desk.passed} успішно, середній результат ${desk.avg}%.\n`;
        if (desk.byTemplate?.length) {
            prompt += `  По шаблонах:\n`;
            desk.byTemplate.forEach((template) => {
                prompt += `  - "${template.name}": ${template.count} спроб, ${template.passed} успішно, середній ${template.avg}%\n`;
            });
        }
        prompt += '\n';
    }

    if (summary.byType.game) {
        const game = summary.byType.game;
        prompt += `ІГРОВІ СЦЕНАРІЇ: ${game.count} проходжень, ${game.wins} перемог (${game.winRate}%).\n`;
        if (game.byScenario?.length) {
            prompt += `  По сценаріях:\n`;
            game.byScenario.forEach((scenario) => {
                prompt += `  - "${scenario.name}": ${scenario.count} спроб, ${scenario.wins} перемог (${scenario.winRate}%)\n`;
            });
        }
        prompt += '\n';
    }

    if (summary.byType.quiz) {
        const quiz = summary.byType.quiz;
        prompt += `КВІЗИ: ${quiz.count} тестів, ${quiz.passed} успішно, середній результат ${quiz.avg}%.\n\n`;
    }

    if (summary.byType.complex) {
        const complex = summary.byType.complex;
        prompt += `КОМПЛЕКСНІ ТЕСТИ: ${complex.count} проходжень, ${complex.passed} успішно.\n\n`;
    }

    const cities = Object.entries(summary.byCityMap);
    if (cities.length > 0) {
        prompt += `ПО МІСТАХ:\n`;
        cities.forEach(([name, data]) => {
            prompt += `  - ${name}: ${data.count} тестів, ${successRate(data.passed, data.count)}% успішність\n`;
        });
        prompt += '\n';
    }

    if (summary.strongestCities.length > 0 || summary.weakestCities.length > 0) {
        prompt += `ЛІДЕРИ ТА РИЗИКИ ПО МІСТАХ:\n`;
        summary.strongestCities.forEach((entry) => {
            prompt += `  + Сильне місто: ${entry.name} — ${entry.successRate}% успішності (${entry.count} спроб)\n`;
        });
        summary.weakestCities.forEach((entry) => {
            prompt += `  - Слабке місто: ${entry.name} — ${entry.successRate}% успішності (${entry.count} спроб)\n`;
        });
        prompt += '\n';
    }

    const positions = Object.entries(summary.byPosition);
    if (positions.length > 0) {
        prompt += `ПО ПОСАДАХ:\n`;
        positions.forEach(([name, data]) => {
            prompt += `  - ${name}: ${data.count} тестів, ${successRate(data.passed, data.count)}% успішність\n`;
        });
        prompt += '\n';
    }

    if (summary.strongestPositions.length > 0 || summary.weakestPositions.length > 0) {
        prompt += `ЛІДЕРИ ТА РИЗИКИ ПО ПОСАДАХ:\n`;
        summary.strongestPositions.forEach((entry) => {
            prompt += `  + Сильна посада: ${entry.name} — ${entry.successRate}% успішності (${entry.count} спроб)\n`;
        });
        summary.weakestPositions.forEach((entry) => {
            prompt += `  - Слабка посада: ${entry.name} — ${entry.successRate}% успішності (${entry.count} спроб)\n`;
        });
        prompt += '\n';
    }

    if (summary.byType.desk?.byTemplate?.length) {
        prompt += `НАЙСЛАБШІ ШАБЛОНИ СЕРВІРУВАННЯ:\n`;
        summary.byType.desk.byTemplate.slice(0, 3).forEach((template) => {
            prompt += `  - ${template.name}: ${template.avg}% середній результат (${template.count} спроб)\n`;
        });
        prompt += '\n';
    }

    if (summary.byType.game?.byScenario?.length) {
        prompt += `НАЙСЛАБШІ ІГРОВІ СЦЕНАРІЇ:\n`;
        summary.byType.game.byScenario.slice(0, 3).forEach((scenario) => {
            prompt += `  - ${scenario.name}: ${scenario.winRate}% перемог (${scenario.count} спроб)\n`;
        });
        prompt += '\n';
    }

    const timeline = Object.entries(summary.timeline).sort(([left], [right]) => left.localeCompare(right));
    if (timeline.length > 1) {
        prompt += `ДИНАМІКА (останні дні):\n`;
        timeline.slice(-10).forEach(([day, data]) => {
            prompt += `  ${day}: ${data.passed} успішних, ${data.failed} провалених\n`;
        });
        prompt += '\n';
    }

    prompt += `ПРАВИЛА ВІДПОВІДІ:
- Відповідай тільки українською.
- Не вигадуй причин, якщо вони не випливають із даних.
- У кожному важливому висновку посилайся на числа, відсотки або порівняння.
- Якщо вибірка мала (1-2 спроби), називай це слабким сигналом, а не твердим висновком.
- Не просто описуй дані, а пояснюй, що це означає для навчання команди.
- Рекомендації формулюй як конкретні дії, а не загальні побажання.
- Не використовуй таблиці.
- Уникай довгих абзаців: краще короткі блоки або маркери.
- У фіналі дай чіткий список пріоритетів, що робити далі.

ФОРМАТ ВІДПОВІДІ:
- Кожен розділ починай з emoji та короткого заголовка.
- У кожному розділі 2-4 змістовні пункти або короткі абзаци.
- Завершуй відповідь блоком "Пріоритети на найближчий період".
`;

    if (mode === 'dashboard') {
        prompt += `Дай короткий управлінський огляд для керівника. Обов'язково включи:
1. 📊 Загальну оцінку стану навчання.
2. 💪 Сильні сторони.
3. ⚠️ Слабкі місця.
4. 📈 Головні тренди.
5. 🎯 3-5 конкретних дій для тренерів.
 6. 🏙️ Які міста та посади зараз найсильніші і найризиковіші.
 7. ✅ Наприкінці дай 3 пріоритети на найближчі 7 днів.`;
    } else {
        prompt += `Дай детальний аналітичний висновок для тренера або адміністратора. Обов'язково включи:
1. 📊 Загальну картину.
2. ⚠️ Проблемні зони по типах тестів.
3. 🧩 Найслабші шаблони чи сценарії.
4. 🏙️ Порівняння міст.
5. 👤 Порівняння посад.
6. 📈 Що покращується, а що просідає.
 7. 💡 Практичні рекомендації для організації навчання.
 8. ✅ Наприкінці дай 5 пріоритетних дій у порядку важливості.`;
    }

    return prompt;
}

module.exports = router;
