/**
 * Platform-based data isolation utility.
 *
 * Users with platform = '' are global superadmins and see ALL data.
 * Users with platform = 'funadmin' (or any non-empty value) are isolated
 * to content owned by users on the same platform.
 *
 * Legacy documents without a `platform` field are treated as platform = ''.
 */

const User = require('../models/User');

/**
 * Build a base MongoDB filter that scopes queries to the user's platform + role.
 *
 * @param {Object} user - req.user (must have _id, role, city, platform)
 * @param {string} [cityField='studentCity'] - name of the city field on the collection
 * @returns {Object} MongoDB query filter
 */
function buildBaseFilter(user, cityField = 'studentCity') {
  // Global superadmin (platform '') sees everything
  if (user.role === 'superadmin' && !user.platform) {
    return {};
  }

  // Platform superadmin — sees all content from their platform's users
  if (user.role === 'superadmin' && user.platform) {
    return { platform: user.platform };
  }

  // Non-superadmin — sees own content + city-targeted content, scoped to platform
  const orConditions = [{ ownerId: user._id }];
  if (user.city) orConditions.push({ [cityField]: user.city });

  const filter = { $or: orConditions };
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
  // Global superadmin — no restrictions
  if (user.role === 'superadmin' && !user.platform) return query;
  // Platform superadmin — restrict to platform
  if (user.role === 'superadmin' && user.platform) {
    query.platform = user.platform;
    return query;
  }
  // Others — must own the document
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
  if (!platform) return {}; // global sees all
  return { platform };
}

/**
 * Cache of platform user IDs (platform → Set of _id strings).
 * Refreshed on demand with a short TTL.
 */
let _platformUsersCache = {};
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getPlatformUserIds(platform) {
  if (!platform) return null; // global — no restriction
  const now = Date.now();
  if (now - _cacheTime > CACHE_TTL) {
    _platformUsersCache = {};
    _cacheTime = now;
  }
  if (!_platformUsersCache[platform]) {
    const users = await User.find({ platform }, '_id').lean();
    _platformUsersCache[platform] = users.map(u => u._id);
  }
  return _platformUsersCache[platform];
}

/**
 * Build a filter for result models that have ownerId but no platform field.
 * For platform users, restricts to ownerIds belonging to the same platform.
 *
 * @param {Object} user - req.user
 * @param {string} [cityField='studentCity']
 * @returns {Promise<Object>} MongoDB query filter
 */
async function buildResultFilter(user, cityField = 'studentCity') {
  // Global superadmin
  if (user.role === 'superadmin' && !user.platform) return {};

  // Platform superadmin — restrict to results owned by platform users
  if (user.role === 'superadmin' && user.platform) {
    const ids = await getPlatformUserIds(user.platform);
    return { ownerId: { $in: ids } };
  }

  // Non-superadmin
  const orConditions = [{ ownerId: user._id }];
  if (user.city) orConditions.push({ [cityField]: user.city });
  return { $or: orConditions };
}

module.exports = {
  buildBaseFilter,
  buildOwnerQuery,
  platformModelFilter,
  buildResultFilter,
  getPlatformUserIds
};
