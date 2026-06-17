import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('cuenta_retiro')
    .select('*, usuario:usuario_id (nombre, apellido1, correo)');
  console.log('Error:', error);
  console.dir(data, { depth: null });
}

main();
