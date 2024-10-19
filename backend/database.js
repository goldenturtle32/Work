const { Pool } = require('pg');
const pool = new Pool({
  user: 'your_user',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
