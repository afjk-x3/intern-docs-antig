import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = 'approver@makerspace.ph';
  const password = 'Password12345!';

  console.log(`Creating test approver: ${email}...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (error) {
    if (error.message.includes('already exists') || error.message.includes('unique')) {
      console.log(`User ${email} already exists in auth.users.`);
    } else {
      console.error("Error creating user in auth:", error.message);
      return;
    }
  } else {
    console.log("Created auth user ID:", data.user.id);
    
    // Insert into public.users
    const { error: insertError } = await supabase.from('users').upsert({
      id: data.user.id,
      email,
      role: 'approver'
    });
    
    if (insertError) {
      console.error("Error inserting into public.users:", insertError.message);
    } else {
      console.log("Successfully created and mapped approver in public.users!");
    }
  }
}

run();
