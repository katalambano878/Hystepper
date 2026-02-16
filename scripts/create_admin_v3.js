const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://rwsentatgbmxlfaecnqm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3c2VudGF0Z2JteGxmYWVjbnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODgzNjksImV4cCI6MjA4NTg2NDM2OX0.QNAwmMc8_4B60KlSNkei6LmDCn5RwT4FlHOVASgP34I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function signUp() {
    const email = 'admin@hystepper.com';
    const password = 'password123';
    const logFile = 'scripts/admin_creation_log_v3.txt';

    fs.writeFileSync(logFile, `Starting creation for ${email}...\n`);

    try {
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
            fs.appendFileSync(logFile, `Error: ${error.message}\n`);
        } else {
            if (data.user) {
                fs.appendFileSync(logFile, `Success: User created with ID ${data.user.id}\n`);
            } else {
                fs.appendFileSync(logFile, `Check: User object missing\n`);
            }
        }
    } catch (err) {
        fs.appendFileSync(logFile, `Exception: ${err.message}\n`);
    }
}

signUp();
