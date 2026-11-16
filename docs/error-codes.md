# Error codes

Every error the API returns, generated from the source (`AppError` and its helpers).
Responses look like `{ "error": { "code", "message", "details?" }, "requestId" }`. Apps show text by `code`;
`message` is for developers. Also returned by middleware: `VALIDATION_FAILED` (400, `details.fields`),
`INVALID_JSON` (400), `PAYLOAD_TOO_LARGE` (413), `ROUTE_NOT_FOUND` (404), `INTERNAL` (500).

Regenerate after adding codes: `npm run docs:errors`.

| Code                        | Status | Where                                          |
| --------------------------- | ------ | ---------------------------------------------- |
| `STORAGE_NOT_CONFIGURED`    | 503    | adapters                                       |
| `ADMIN_CODE_INVALID`        | 401    | admin                                          |
| `ADMIN_LOGIN_FAILED`        | 401    | admin                                          |
| `ADMIN_LOGIN_LOCKED`        | 429    | admin                                          |
| `ADMIN_PASSWORD_WRONG`      | 401    | admin                                          |
| `ADMIN_SESSION_EXPIRED`     | 401    | admin                                          |
| `ADMIN_SESSION_INVALID`     | 401    | admin, middleware                              |
| `PASSWORD_TOO_SHORT`        | 400    | admin                                          |
| `VALIDATION_FAILED`         | 400    | admin, astrologers, catalog, middleware, users |
| `APPLICATION_INCOMPLETE`    | 400    | astrologers                                    |
| `APPLICATION_LOCKED`        | 409    | astrologers                                    |
| `ASTROLOGER_NOT_FOUND`      | 404    | astrologers                                    |
| `ASTROLOGER_SUSPENDED`      | 403    | astrologers                                    |
| `BIO_NOT_ALLOWED`           | 400    | astrologers                                    |
| `DOCUMENT_NOT_FOUND`        | 404    | astrologers                                    |
| `DOCUMENTS_NOT_VERIFIED`    | 409    | astrologers                                    |
| `INTERVIEW_IN_PAST`         | 400    | astrologers                                    |
| `KYC_NOT_FOUND`             | 404    | astrologers                                    |
| `MODE_NOT_ENABLED`          | 403    | astrologers                                    |
| `NO_CONSULT_MODE`           | 400    | astrologers                                    |
| `NOT_AN_ASTROLOGER`         | 404    | astrologers                                    |
| `NOT_APPROVED`              | 409    | astrologers                                    |
| `NOT_APPROVED_YET`          | 409    | astrologers                                    |
| `NOT_IN_REVIEW`             | 409    | astrologers                                    |
| `NOT_REJECTED`              | 409    | astrologers                                    |
| `NOT_SUSPENDED`             | 409    | astrologers                                    |
| `NOTHING_TO_WITHDRAW`       | 409    | astrologers                                    |
| `PLACE_NOT_FOUND`           | 400    | astrologers, users                             |
| `RATE_ABOVE_CAP`            | 400    | astrologers                                    |
| `RATE_MISSING`              | 400    | astrologers                                    |
| `RATE_REQUEST_NOT_FOUND`    | 404    | astrologers                                    |
| `RATE_TOO_LOW`              | 400    | astrologers                                    |
| `RATE_UNCHANGED`            | 400    | astrologers                                    |
| `REAPPLY_TOO_SOON`          | 409    | astrologers                                    |
| `REVISION_NOT_FOUND`        | 404    | astrologers                                    |
| `REVISION_PENDING`          | 409    | astrologers                                    |
| `SCHEDULE_EMPTY`            | 400    | astrologers                                    |
| `SLOT_INVALID`              | 400    | astrologers                                    |
| `SLOT_OVERLAP`              | 400    | astrologers                                    |
| `UNKNOWN_METHOD`            | 400    | astrologers                                    |
| `UNKNOWN_TOPIC`             | 400    | astrologers, users                             |
| `UPLOAD_INVALID`            | 400    | astrologers                                    |
| `UPLOAD_MISMATCH`           | 400    | astrologers                                    |
| `UPLOAD_MISSING`            | 400    | astrologers                                    |
| `UPLOAD_NOT_FOUND`          | 404    | astrologers                                    |
| `UPLOAD_TOO_LARGE`          | 400    | astrologers                                    |
| `UPLOAD_TYPE_NOT_ALLOWED`   | 400    | astrologers                                    |
| `ACCOUNT_DELETED`           | 403    | auth                                           |
| `INVALID_MOBILE`            | 400    | auth                                           |
| `OTP_EXPIRED`               | 400    | auth                                           |
| `OTP_INVALID`               | 400    | auth                                           |
| `OTP_LOCKED`                | 429    | auth                                           |
| `OTP_NOT_REQUESTED`         | 400    | auth                                           |
| `OTP_RESEND_COOLDOWN`       | 429    | auth                                           |
| `REFRESH_EXPIRED`           | 401    | auth                                           |
| `REFRESH_INVALID`           | 401    | auth                                           |
| `REFRESH_REUSED`            | 401    | auth                                           |
| `SESSION_REVOKED`           | 401    | auth, middleware                               |
| `SMS_SEND_FAILED`           | 502    | auth                                           |
| `TOKEN_EXPIRED`             | 401    | auth                                           |
| `TOKEN_INVALID`             | 401    | auth                                           |
| `USER_NOT_FOUND`            | 404    | auth, users                                    |
| `ADMIN_IP_NOT_ALLOWED`      | 403    | middleware                                     |
| `STEP_UP_REQUIRED`          | 403    | middleware                                     |
| `WRONG_APP`                 | 403    | middleware                                     |
| `SETTING_ALREADY_CANCELLED` | 409    | settings                                       |
| `SETTING_ALREADY_EFFECTIVE` | 409    | settings                                       |
| `SETTING_BACKDATED`         | 400    | settings                                       |
| `SETTING_INVALID`           | 400    | settings                                       |
| `SETTING_NOT_FOUND`         | 404    | settings                                       |
| `SETTING_VERSION_NOT_FOUND` | 404    | settings                                       |
| `ACCOUNT_SUSPENDED`         | 409    | users                                          |
| `BIRTH_PROFILE_LIMIT`       | 409    | users                                          |
| `BIRTH_PROFILE_NOT_FOUND`   | 404    | users                                          |
| `DOB_IN_FUTURE`             | 400    | users                                          |
| `DOB_TOO_EARLY`             | 400    | users                                          |
| `NO_DELETION_PENDING`       | 404    | users                                          |
| `PREFERENCES_NOT_FOUND`     | 404    | users                                          |
| `PROFILE_UNDER_18`          | 400    | users                                          |
| `SELF_PROFILE_EXISTS`       | 409    | users                                          |
| `SESSION_IN_PROGRESS`       | 409    | users                                          |
