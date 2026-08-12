const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log('✅ Connected to Supabase!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Server time:', res.rows[0].now);
    client.end();
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
    client.end();
  });