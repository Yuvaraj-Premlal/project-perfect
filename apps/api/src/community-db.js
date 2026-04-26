const { Pool } = require('pg');

const communityPool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: 'pp_community',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

communityPool.connect((err, client, release) => {
  if (err) {
    console.error('Community DB connection error:', err.message);
  } else {
    console.log('Community database connected successfully');
    release();
  }
});

module.exports = communityPool;
