import {
  appEnvSchema,
  createEnvValidator,
  seederEnvSchema,
} from './env.schema';

const validEnv = {
  MONGODB_URI: 'mongodb://localhost:27017/capy',
  TELEGRAM_BOT_TOKEN: '123456:test-token',
};

describe('appEnvSchema', () => {
  const validate = createEnvValidator(appEnvSchema);

  it('applies defaults for optional settings', () => {
    const env = validate(validEnv);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('disables CORS and uses a 24h init data lifetime by default', () => {
    const env = validate(validEnv);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.TELEGRAM_AUTH_MAX_AGE_SECONDS).toBe(86400);
  });

  it('parses a comma-separated CORS allow-list', () => {
    const env = validate({
      ...validEnv,
      CORS_ORIGINS: 'https://capy.example, http://localhost:5173',
    });
    expect(env.CORS_ORIGINS).toEqual([
      'https://capy.example',
      'http://localhost:5173',
    ]);
  });

  it('rejects CORS entries that are not URLs', () => {
    expect(() => validate({ ...validEnv, CORS_ORIGINS: '*' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('coerces PORT from string', () => {
    expect(validate({ ...validEnv, PORT: '8080' }).PORT).toBe(8080);
  });

  it('strips quotes and whitespace from secrets', () => {
    const env = validate({ ...validEnv, OPENAI_API_KEY: '  "sk-test"  ' });
    expect(env.OPENAI_API_KEY).toBe('sk-test');
  });

  it('treats empty optional secrets as missing', () => {
    expect(
      validate({ ...validEnv, GROQ_API_KEY: '' }).GROQ_API_KEY,
    ).toBeUndefined();
  });

  it('fails fast when the bot token is missing', () => {
    expect(() => validate({ MONGODB_URI: validEnv.MONGODB_URI })).toThrow(
      /TELEGRAM_BOT_TOKEN/,
    );
  });

  it('rejects a non-Mongo connection string', () => {
    expect(() =>
      validate({ ...validEnv, MONGODB_URI: 'postgres://localhost/capy' }),
    ).toThrow(/MONGODB_URI/);
  });

  it('does not leak secret values in the error message', () => {
    const run = () =>
      validate({
        ...validEnv,
        MONGODB_URI: 'http://user:hunter2@host',
        PORT: 'abc',
      });
    expect(run).toThrow(/PORT/);
    expect(run).not.toThrow(/hunter2/);
  });
});

describe('seederEnvSchema', () => {
  it('requires only the database connection', () => {
    const env = createEnvValidator(seederEnvSchema)({
      MONGODB_URI: validEnv.MONGODB_URI,
    });
    expect(env.MONGODB_URI).toBe(validEnv.MONGODB_URI);
  });
});
