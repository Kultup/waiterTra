const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const { buildResultFilter } = require('./platformFilter');

const trimText = (value) => String(value || '').trim();

const toBase64Url = (value) => Buffer.from(value, 'utf8')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const fromBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

function normalizeStudentIdentity(identity = {}) {
  return {
    studentName: trimText(identity.studentName),
    studentLastName: trimText(identity.studentLastName),
    studentCity: trimText(identity.studentCity || identity.city)
  };
}

function buildStudentKey(identity) {
  return toBase64Url(JSON.stringify(normalizeStudentIdentity(identity)));
}

function parseStudentKey(key) {
  try {
    const parsed = JSON.parse(fromBase64Url(key));
    const identity = normalizeStudentIdentity(parsed);
    if (!identity.studentName || !identity.studentLastName) {
      return null;
    }
    return identity;
  } catch (error) {
    return null;
  }
}

function buildIdentityQuery(identity, cityField = 'studentCity') {
  const normalizedIdentity = normalizeStudentIdentity(identity);
  return {
    studentName: normalizedIdentity.studentName,
    studentLastName: normalizedIdentity.studentLastName,
    [cityField]: normalizedIdentity.studentCity
  };
}

function getGameIdentityQuery(identity) {
  const normalizedIdentity = normalizeStudentIdentity(identity);
  return {
    studentName: normalizedIdentity.studentName,
    studentLastName: normalizedIdentity.studentLastName,
    city: normalizedIdentity.studentCity
  };
}

function getNumericValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizePercentage(score, total) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((score / total) * 100);
}

function getResultMetrics(type, result) {
  if (type === 'game') {
    const score = result.isWin ? 1 : 0;
    return {
      score,
      total: 1,
      percentage: score ? 100 : 0,
      passed: Boolean(result.isWin)
    };
  }

  if (type === 'complex') {
    const steps = Array.isArray(result.steps) ? result.steps : [];
    const stepScore = steps.reduce((sum, step) => sum + getNumericValue(step.score), 0);
    const stepTotal = steps.reduce((sum, step) => sum + getNumericValue(step.total), 0);

    if (stepTotal > 0) {
      return {
        score: stepScore,
        total: stepTotal,
        percentage: normalizePercentage(stepScore, stepTotal),
        passed: Boolean(result.overallPassed)
      };
    }

    const passedSteps = steps.filter((step) => step.passed).length;
    const totalSteps = steps.length;
    return {
      score: passedSteps,
      total: totalSteps,
      percentage: normalizePercentage(passedSteps, totalSteps),
      passed: Boolean(result.overallPassed)
    };
  }

  const score = getNumericValue(result.score);
  const total = getNumericValue(result.total);
  const percentage = Number.isFinite(Number(result.percentage))
    ? Number(result.percentage)
    : normalizePercentage(score, total);

  return {
    score,
    total,
    percentage,
    passed: Boolean(result.passed)
  };
}

function toHistoryEntry(type, doc) {
  const result = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const metrics = getResultMetrics(type, result);

  return {
    ...result,
    ...metrics,
    type,
    passed: metrics.passed
  };
}

function buildStudentSummary(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  const [latest] = [...history].sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt));
  const totalTests = history.length;
  const averageScore = Math.round(
    history.reduce((sum, item) => sum + getNumericValue(item.percentage), 0) / totalTests
  );

  return {
    _id: buildStudentKey(latest),
    studentName: trimText(latest.studentName),
    studentLastName: trimText(latest.studentLastName),
    studentCity: trimText(latest.studentCity || latest.city),
    totalTests,
    avgScore: averageScore,
    lastActivity: latest.completedAt
  };
}

function buildStudentSummaries(history) {
  const grouped = new Map();

  history.forEach((item) => {
    const key = buildStudentKey(item);
    const bucket = grouped.get(key) || [];
    bucket.push(item);
    grouped.set(key, bucket);
  });

  return [...grouped.values()]
    .map((items) => buildStudentSummary(items))
    .filter(Boolean)
    .sort((left, right) => {
      const lastNameCompare = left.studentLastName.localeCompare(right.studentLastName, 'uk');
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }
      return left.studentName.localeCompare(right.studentName, 'uk');
    });
}

async function fetchAccessibleResultGroups(user, options = {}) {
  const identity = options.identity ? normalizeStudentIdentity(options.identity) : null;
  const includeRelations = Boolean(options.includeRelations);

  const deskQuery = { ...(await buildResultFilter(user, 'studentCity')) };
  const gameQuery = { ...(await buildResultFilter(user, 'city')) };
  const quizQuery = { ...(await buildResultFilter(user, 'studentCity')) };
  const complexQuery = { ...(await buildResultFilter(user, 'studentCity')) };

  if (identity) {
    Object.assign(deskQuery, buildIdentityQuery(identity, 'studentCity'));
    Object.assign(gameQuery, getGameIdentityQuery(identity));
    Object.assign(quizQuery, buildIdentityQuery(identity, 'studentCity'));
    Object.assign(complexQuery, buildIdentityQuery(identity, 'studentCity'));
  }

  const deskPromise = TestResult.find(deskQuery).sort({ completedAt: -1 });
  const gamePromise = GameResult.find(gameQuery).sort({ completedAt: -1 });
  const quizPromise = includeRelations
    ? QuizResult.find(quizQuery).populate('quizId', 'title').sort({ completedAt: -1 })
    : QuizResult.find(quizQuery).sort({ completedAt: -1 });
  const complexPromise = includeRelations
    ? ComplexTestResult.find(complexQuery).populate('complexTestId', 'title').sort({ completedAt: -1 })
    : ComplexTestResult.find(complexQuery).sort({ completedAt: -1 });

  const [desk, game, quiz, complex] = await Promise.all([
    deskPromise,
    gamePromise,
    quizPromise,
    complexPromise
  ]);

  return { desk, game, quiz, complex };
}

async function fetchAccessibleStudentHistory(user, options = {}) {
  const groups = await fetchAccessibleResultGroups(user, options);

  return [
    ...groups.desk.map((result) => toHistoryEntry('desk', result)),
    ...groups.game.map((result) => toHistoryEntry('game', result)),
    ...groups.quiz.map((result) => toHistoryEntry('quiz', result)),
    ...groups.complex.map((result) => toHistoryEntry('complex', result))
  ].sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt));
}

module.exports = {
  normalizeStudentIdentity,
  buildStudentKey,
  parseStudentKey,
  buildIdentityQuery,
  getGameIdentityQuery,
  buildStudentSummary,
  buildStudentSummaries,
  fetchAccessibleStudentHistory
};
