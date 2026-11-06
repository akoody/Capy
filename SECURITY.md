# Security Policy

## Supported Versions

We actively support the latest version of the application. Security updates are applied as needed.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please contact the repository owner directly.

## Security Best Practices

### For Users

1. **Never commit `.env` files** - Always use `.env.example` as a template
2. **Use strong API keys** - Generate secure, unique API keys for all services
3. **Rotate credentials regularly** - Regularly update API keys and tokens
4. **Keep dependencies updated** - Run `npm audit` regularly to check for vulnerabilities

### For Developers

1. All sensitive data must be stored in environment variables
2. Never log sensitive information (API keys, tokens, passwords)
3. Use HTTPS in production
4. Implement rate limiting on sensitive endpoints
5. Validate and sanitize all user inputs

## Known Security Features

- Environment variable-based configuration
- Rate limiting on AI analysis endpoints (3 requests per 2 hours per user)
- Rate limiting on voice assistant (40 requests per rolling hour per user; stored as `voice` type on analysis requests)
- Input validation using class-validator
- CORS protection
- Telegram authentication middleware

## Dependencies

We regularly update dependencies to patch security vulnerabilities. Run `npm audit` to check for known vulnerabilities:

```bash
npm audit
npm audit fix
```

