const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwsentatgbmxlfaecnqm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3c2VudGF0Z2JteGxmYWVjbnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODgzNjksImV4cCI6MjA4NTg2NDM2OX0.QNAwmMc8_4B60KlSNkei6LmDCn5RwT4FlHOVASgP34I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function signUp() {
    const email = 'admin@hy_stepper.com';
    const password = 'password123';

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
        if (error.message.includes('already registered')) {
            console.log('User already exists.');
        } else {
            console.error('Error creating user:', error.message);
        }
    } else {
        // If successfully created (user might be returned even if email confirmation pending)
        if (data.user) {
            console.log('User created successfully. ID:', data.user.id);
        } else {
            console.log('User creation initiated, check email for confirmation (we will manually confirm via SQL).');
        }
    }
}

signUp();
