/**
 * Platform-based data isolation utility.
 *
 * Users with platform = '' are global superadmins and see all data.
 * Users with platform = 'funadmin' (or any non-empty value) are isolated
 * to content owned by users on the same platform.
 *
 * Legacy documents without a `platform` field are treated as platform = ''.
 */

const User = require('../models/User');

/**
 * Build a base MongoDB filter that scopes resource queries to the user's
 * own documents within their platform.
 *
 * @param {Object} user - req.user (must have _id, role, platform)
 * @returns {Object} MongoDB query filter
 */
function buildBaseFilter(user) {
  if (user.role === 'superadmin' && !user.platform) {
    return {};
  }

  if (user.role === 'superadmin' && user.platform) {
    return { platform: user.platform };
  }

  const filter = { ownerId: user._id };
  if (user.platform) {
    filter.platform = user.platform;
  }

  return filter;
}

/**
 * Build a query for single-document owner operations with platform guard.
 *
 * @param {Object} user - req.user
 * @param {string} id - document _id
 * @returns {Object} MongoDB query
 */
function buildOwnerQuery(user, id) {
  const query = { _id: id };

  if (user.role === 'superadmin' && !user.platform) {
    return query;
  }

  if (user.role === 'superadmin' && user.platform) {
    query.platform = user.platform;
    return query;
  }

  query.ownerId = user._id;
  return query;
}

/**
 * Build a filter for platform-scoped models (City, Dish) that have no ownerId.
 * Legacy documents (no platform field) are treated as global (platform = '').
 *
 * @param {string} platform - user's platform value
 * @returns {Object} MongoDB query filter
 */
function platformModelFilter(platform) {
  if (!platform) {
    return {};
  }

  return { platform };
}

let _platformUsersCache = {};
let _cacheTime = 0;
const CACHE_TTL = 60_000;

async function getPlatformUserIds(platform) {
  if (!platform) {
    return null;
  }

  const now = Date.now();
  if (now - _cacheTime > CACHE_TTL) {
    _platformUsersCache = {};
    _cacheTime = now;
  }

  if (!_platformUsersCache[platform]) {
    const users = await User.find({ platform }, '_id').lean();
    _platformUsersCache[platform] = users.map((user) => user._id);
  }

  return _platformUsersCache[platform];
}

/**
 * Build a filter for result models that have ownerId but no platform field.
 * Admins/trainers see only their own results. Viewers/localadmins see only
 * results for their assigned city.
 *
 * @param {Object} user - req.user
 * @param {string} [cityField='studentCity']
 * @returns {Promise<Object>} MongoDB query filter
 */
async function buildResultFilter(user, cityField = 'studentCity') {
  if (user.role === 'superadmin' && !user.platform) {
    return {};
  }

  if (user.role === 'superadmin' && user.platform) {
    const ids = await getPlatformUserIds(user.platform);
    return { ownerId: { $in: ids } };
  }

  if (['viewer', 'localadmin'].includes(user.role)) {
    if (!user.city) {
      return { _id: null };
    }

    if (!user.platform) {
      return { [cityField]: user.city };
    }

    const ids = await getPlatformUserIds(user.platform);
    return {
      ownerId: { $in: ids },
      [cityField]: user.city
    };
  }

  return { ownerId: user._id };
}

module.exports = {
  buildBaseFilter,
  buildOwnerQuery,
  platformModelFilter,
  buildResultFilter,
  getPlatformUserIds
};
