import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'password12345',
    email_confirm: true
  });
  
  if (error) {
    console.error("Error creating user:", error);
  } else {
    console.log("User created:", data.user.id);
    
    // insert into public.users
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      email: 'test@example.com',
      role: 'intern'
    });
    
    if (insertError) {
      console.error("Error inserting into public.users:", insertError);
    } else {
      console.log("User inserted into public.users");
    }
  }
}

run();
