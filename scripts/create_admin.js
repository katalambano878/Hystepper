const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function signUp() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password || !supabaseUrl || !supabaseKey) {
        console.error('Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD');
        process.exit(1);
    }

    console.log(`Attempting to create user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Hy_stepper Admin'
            }
        }
    });

    if (error) {
        console.error('Error creating user:', error.message);
    } else if (data.user) {
        console.log('User created successfully. ID:', data.user.id);
    } else {
        console.log('User creation initiated, check email for confirmation.');
    }
}

signUp();
