/**
 * clear_results.js — одноразовий скрипт для очищення всіх результатів з БД.
 * Запуск: node server/clear_results.js
 * Або з підтвердженням: node server/clear_results.js --confirm
 */
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

const CONFIRM = process.argv.includes('--confirm');

const COLLECTIONS = [
    'testresults',
    'gameresults',
    'quizresults',
    'complextestresults',
    'pageviews',
];

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq');
    console.log('✅ MongoDB підключено\n');

    const db = mongoose.connection.db;

    for (const col of COLLECTIONS) {
        const count = await db.collection(col).countDocuments();
        console.log(`  ${col}: ${count} записів`);
    }

    if (!CONFIRM) {
        console.log('\n⚠️  Для видалення запустіть з прапором --confirm:');
        console.log('   node server/clear_results.js --confirm\n');
        await mongoose.disconnect();
        return;
    }

    console.log('\n🗑  Видаляємо...');
    for (const col of COLLECTIONS) {
        const res = await db.collection(col).deleteMany({});
        console.log(`  ${col}: видалено ${res.deletedCount}`);
    }

    console.log('\n✅ Готово. Всі результати очищено.\n');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Помилка:', err.message);
    process.exit(1);
});
