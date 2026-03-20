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

// POST /api/ai/analyze
router.post('/analyze', auth, async (req, res) => {
    if (!getGroq()) {
        return res.status(500).json({ error: 'GROQ_API_KEY не налаштовано' });
    }

    const { mode, city, days, tab } = req.body;
    // mode: 'dashboard' | 'results'
    // tab: 'desk' | 'game' | 'quiz' | 'complex' | 'all'

    try {
        // Build date filter
        const dateFilter = {};
        if (days && days > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            dateFilter.completedAt = { $gte: cutoff };
        }

        // Build base filter (role + platform scoped)
        const platformBase = await buildResultFilter(req.user, 'studentCity');
        let baseFilter;
        if (Object.keys(platformBase).length === 0) {
            baseFilter = { ...dateFilter };
        } else {
            baseFilter = { $and: [dateFilter, platformBase] };
        }
        if (city) {
            baseFilter = { ...baseFilter, $or: undefined };
            baseFilter.$and = [
                dateFilter,
                { $or: [{ studentCity: city }, { city: city }, { playerCity: city }] }
            ];
        }

        // Fetch results based on tab
        const fetchTypes = tab && tab !== 'all'
            ? [tab]
            : ['desk', 'game', 'quiz', 'complex'];

        const results = {};
        if (fetchTypes.includes('desk')) {
            results.desk = await TestResult.find(baseFilter).sort({ completedAt: -1 }).limit(200).lean();
        }
        if (fetchTypes.includes('game')) {
            const gameFilter = { ...baseFilter };
            // GameResult uses 'city' not 'studentCity'
            results.game = await GameResult.find(gameFilter).sort({ completedAt: -1 }).limit(200).lean();
        }
        if (fetchTypes.includes('quiz')) {
            results.quiz = await QuizResult.find(baseFilter).sort({ completedAt: -1 }).limit(200).lean();
        }
        if (fetchTypes.includes('complex')) {
            results.complex = await ComplexTestResult.find(baseFilter).sort({ completedAt: -1 }).limit(200).lean();
        }

        // Prepare summary for AI
        const summary = buildSummary(results);

        if (summary.totalResults === 0) {
            return res.json({ analysis: 'Недостатньо даних для аналізу. Спробуйте розширити період або змінити фільтри.' });
        }

        const prompt = buildPrompt(summary, mode, city, days);

        const chatCompletion = await getGroq().chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Ти — AI-аналітик навчальної платформи для персоналу ресторанів та готелів. Аналізуєш результати тестів, квізів та ігрових сценаріїв. Відповідай ТІЛЬКИ українською мовою. Будь конкретним, давай числа та відсотки. Форматуй відповідь з emoji та розділами.'
                },
                { role: 'user', content: prompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            max_tokens: 2000,
        });

        const analysis = chatCompletion.choices[0]?.message?.content || 'Не вдалося отримати аналіз';
        res.json({ analysis });
    } catch (err) {
        console.error('AI analyze error:', err);
        res.status(500).json({ error: err.message || 'Помилка AI аналізу' });
    }
});

function buildSummary(results) {
    const summary = { totalResults: 0, byType: {}, byCityMap: {}, byPosition: {}, timeline: {} };

    // Desk results
    if (results.desk?.length) {
        const items = results.desk;
        summary.totalResults += items.length;
        const passed = items.filter(r => r.passed).length;
        const avg = Math.round(items.reduce((s, r) => s + (r.percentage || 0), 0) / items.length);
        summary.byType.desk = { count: items.length, passed, failed: items.length - passed, avg };

        // Aggregate by template
        const byTemplate = {};
        items.forEach(r => {
            const key = r.templateName || 'Без назви';
            if (!byTemplate[key]) byTemplate[key] = { count: 0, passed: 0, totalPct: 0 };
            byTemplate[key].count++;
            if (r.passed) byTemplate[key].passed++;
            byTemplate[key].totalPct += r.percentage || 0;
        });
        summary.byType.desk.byTemplate = Object.entries(byTemplate).map(([name, d]) => ({
            name, count: d.count, passed: d.passed, avg: Math.round(d.totalPct / d.count)
        }));

        aggregateByCityAndPosition(items, summary, 'studentCity', 'studentPosition');
    }

    // Game results
    if (results.game?.length) {
        const items = results.game;
        summary.totalResults += items.length;
        const wins = items.filter(r => r.isWin).length;
        summary.byType.game = { count: items.length, wins, losses: items.length - wins, winRate: Math.round(wins / items.length * 100) };

        const byScenario = {};
        items.forEach(r => {
            const key = r.scenarioTitle || 'Без назви';
            if (!byScenario[key]) byScenario[key] = { count: 0, wins: 0 };
            byScenario[key].count++;
            if (r.isWin) byScenario[key].wins++;
        });
        summary.byType.game.byScenario = Object.entries(byScenario).map(([name, d]) => ({
            name, count: d.count, wins: d.wins, winRate: Math.round(d.wins / d.count * 100)
        }));

        aggregateByCityAndPosition(items, summary, 'playerCity', 'playerPosition', 'city');
    }

    // Quiz results
    if (results.quiz?.length) {
        const items = results.quiz;
        summary.totalResults += items.length;
        const passed = items.filter(r => r.percentage >= 80).length;
        const avg = Math.round(items.reduce((s, r) => s + (r.percentage || 0), 0) / items.length);
        summary.byType.quiz = { count: items.length, passed, failed: items.length - passed, avg };

        aggregateByCityAndPosition(items, summary, 'studentCity', 'studentPosition');
    }

    // Complex results
    if (results.complex?.length) {
        const items = results.complex;
        summary.totalResults += items.length;
        const passed = items.filter(r => r.overallPassed).length;
        summary.byType.complex = { count: items.length, passed, failed: items.length - passed };

        aggregateByCityAndPosition(items, summary, 'studentCity', 'studentPosition');
    }

    // Build timeline
    const allItems = [
        ...(results.desk || []).map(r => ({ date: r.completedAt, passed: r.passed })),
        ...(results.game || []).map(r => ({ date: r.completedAt, passed: r.isWin })),
        ...(results.quiz || []).map(r => ({ date: r.completedAt, passed: r.percentage >= 80 })),
        ...(results.complex || []).map(r => ({ date: r.completedAt, passed: r.overallPassed })),
    ];
    allItems.forEach(r => {
        const day = new Date(r.date).toISOString().split('T')[0];
        if (!summary.timeline[day]) summary.timeline[day] = { passed: 0, failed: 0 };
        if (r.passed) summary.timeline[day].passed++;
        else summary.timeline[day].failed++;
    });

    return summary;
}

function aggregateByCityAndPosition(items, summary, cityField, posField, altCityField) {
    items.forEach(r => {
        const city = r[cityField] || (altCityField && r[altCityField]) || 'Невідомо';
        const pos = r[posField] || 'Невідомо';
        if (!summary.byCityMap[city]) summary.byCityMap[city] = { count: 0, passed: 0 };
        summary.byCityMap[city].count++;
        if (r.passed || r.isWin || (r.percentage && r.percentage >= 80) || r.overallPassed) {
            summary.byCityMap[city].passed++;
        }
        if (!summary.byPosition[pos]) summary.byPosition[pos] = { count: 0, passed: 0 };
        summary.byPosition[pos].count++;
        if (r.passed || r.isWin || (r.percentage && r.percentage >= 80) || r.overallPassed) {
            summary.byPosition[pos].passed++;
        }
    });
}

function buildPrompt(summary, mode, city, days) {
    const periodText = days ? `за останні ${days} днів` : 'за весь час';
    const cityText = city ? ` по місту ${city}` : '';

    let prompt = `Проаналізуй результати навчання персоналу ресторанів${cityText} ${periodText}.\n\n`;
    prompt += `ЗАГАЛОМ: ${summary.totalResults} результатів.\n\n`;

    if (summary.byType.desk) {
        const d = summary.byType.desk;
        prompt += `СЕРВІРУВАННЯ СТОЛУ: ${d.count} тестів, ${d.passed} здали (${d.avg}% середній).\n`;
        if (d.byTemplate?.length) {
            prompt += `  По шаблонах:\n`;
            d.byTemplate.forEach(t => {
                prompt += `  - "${t.name}": ${t.count} спроб, ${t.passed} здали, середній ${t.avg}%\n`;
            });
        }
        prompt += '\n';
    }

    if (summary.byType.game) {
        const g = summary.byType.game;
        prompt += `ІГРОВІ СЦЕНАРІЇ: ${g.count} проходжень, ${g.wins} перемог (${g.winRate}%).\n`;
        if (g.byScenario?.length) {
            prompt += `  По сценаріях:\n`;
            g.byScenario.forEach(s => {
                prompt += `  - "${s.name}": ${s.count} спроб, ${s.wins} перемог (${s.winRate}%)\n`;
            });
        }
        prompt += '\n';
    }

    if (summary.byType.quiz) {
        const q = summary.byType.quiz;
        prompt += `КВІЗИ: ${q.count} тестів, ${q.passed} здали (${q.avg}% середній).\n\n`;
    }

    if (summary.byType.complex) {
        const c = summary.byType.complex;
        prompt += `КОМПЛЕКСНІ ТЕСТИ: ${c.count} проходжень, ${c.passed} здали.\n\n`;
    }

    // Cities
    const citiesArr = Object.entries(summary.byCityMap);
    if (citiesArr.length > 0) {
        prompt += `ПО МІСТАХ:\n`;
        citiesArr.forEach(([name, data]) => {
            const rate = Math.round(data.passed / data.count * 100);
            prompt += `  - ${name}: ${data.count} тестів, ${rate}% успішність\n`;
        });
        prompt += '\n';
    }

    // Positions
    const posArr = Object.entries(summary.byPosition);
    if (posArr.length > 0) {
        prompt += `ПО ПОСАДАХ:\n`;
        posArr.forEach(([name, data]) => {
            const rate = Math.round(data.passed / data.count * 100);
            prompt += `  - ${name}: ${data.count} тестів, ${rate}% успішність\n`;
        });
        prompt += '\n';
    }

    // Timeline
    const timeline = Object.entries(summary.timeline).sort(([a], [b]) => a.localeCompare(b));
    if (timeline.length > 1) {
        prompt += `ДИНАМІКА (останні дні):\n`;
        timeline.slice(-10).forEach(([day, data]) => {
            prompt += `  ${day}: ${data.passed} успішних, ${data.failed} провалених\n`;
        });
        prompt += '\n';
    }

    if (mode === 'dashboard') {
        prompt += `\nДай загальний огляд стану навчання. Визнач:
1. 📊 Загальна оцінка (коротко, 1-2 речення)
2. 💪 Сильні сторони (що добре)
3. ⚠️ Слабкі місця (де проблеми)
4. 📈 Тренди (покращення чи погіршення)
5. 🎯 Рекомендації для тренерів (3-5 конкретних дій)
6. 🏆 Топ-місто / найгірше місто (якщо є дані по містах)`;
    } else {
        prompt += `\nДай детальний аналіз результатів. Визнач:
1. 📊 Загальна картина
2. ⚠️ Проблемні зони (конкретні тести/шаблони з низькими результатами)
3. 🏙️ Порівняння міст (якщо є)
4. 👤 Аналіз по посадах
5. 📈 Тренд успішності
6. 🎯 Що конкретно треба покращити (по кожному типу тестів)
7. 💡 Рекомендації для організації навчання`;
    }

    return prompt;
}

module.exports = router;
