const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/trifobet' // Typical default local pg
  });
  
  try {
    await client.connect();
    
    // Check ticket messages
    const res = await client.query('SELECT * FROM ticket_soporte_mensaje ORDER BY id DESC LIMIT 5');
    console.log("MESSAGES:", res.rows);
    
    // Check user roles
    const res2 = await client.query('SELECT id, nombre_usuario, rol_id FROM usuario WHERE id IN (SELECT usuario_id FROM ticket_soporte_mensaje)');
    console.log("USERS:", res2.rows);
    
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
check();
