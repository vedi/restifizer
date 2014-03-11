/**
 * Created by vedi on 3/11/14.
 */

var HTTP_STATUSES = {
    OK: {code: 200, message: 'OK'},
    CREATED: {code: 201, message: 'Created'},
    BAD_REQUEST: {code: 400, message: 'Bad Request'},
    FORBIDDEN: {code: 403, message: 'Forbidden'},
    NOT_FOUND: {code: 404, message: 'Not Found'},
    INTERNAL_ERROR: {code: 500, message: 'Internal Server Error'}
};

module.exports.HTTP_STATUSES = HTTP_STATUSES;