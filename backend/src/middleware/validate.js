'use strict';
// Request validation with zod. Unknown keys (strict schemas) -> 400 listing the rejected keys;
// any other rule failure -> 422 with a `details` array of field errors.
const { badRequest, unprocessable } = require('./errors');

function toDetails(issues, location) {
  return issues.map((i) => ({
    field: [location, ...i.path].join('.'),
    message: i.message,
  }));
}

/**
 * validate({ body, query, params }) - each a zod schema. Parsed values replace the originals
 * (req.query is copied to req.validQuery because Express 4 query is a getter in some setups).
 */
function validate(schemas) {
  return function validator(req, res, next) {
    for (const location of ['params', 'query', 'body']) {
      const schema = schemas[location];
      if (!schema) continue;
      const input = location === 'body' ? (req.body ?? {}) : req[location];
      const result = schema.safeParse(input);
      if (!result.success) {
        const unknown = result.error.issues.filter((i) => i.code === 'unrecognized_keys');
        if (unknown.length) {
          const keys = unknown.flatMap((i) => i.keys);
          return next(
            badRequest(
              `Field(s) not allowed: ${keys.join(', ')}`,
              keys.map((k) => ({ field: `${location}.${k}`, message: 'Field is not allowed' }))
            )
          );
        }
        return next(unprocessable('One or more fields are invalid', toDetails(result.error.issues, location)));
      }
      if (location === 'query') req.validQuery = result.data;
      else req[location] = result.data;
    }
    return next();
  };
}

module.exports = { validate };
