/**
 * Окружение для e2e: выставляется до импорта AppModule,
 * потому что ConfigModule валидирует env при загрузке модуля.
 */
const baseUri = (
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:27017'
).replace(/\/$/, '');

// directConnection: replica set из одного узла, транзакции MongoDB требуют его.
process.env.MONGODB_URI = `${baseUri}/capy_e2e_${process.pid}_${Date.now()}?directConnection=true`;
process.env.TELEGRAM_BOT_TOKEN = '777:e2e-bot-token';
process.env.NODE_ENV = 'test';
