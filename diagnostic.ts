
import { supabase } from './services/supabaseClient';

async function checkSchema() {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) {
        console.error('Error fetching profile:', error);
    } else {
        console.log('Profile columns:', data && data[0] ? Object.keys(data[0]) : 'No data');
    }

    const { data: expData, error: expError } = await supabase.from('expenses').select('*').limit(1);
    if (expError) {
        console.error('Error fetching expense:', expError);
    } else {
        console.log('Expense columns:', expData && expData[0] ? Object.keys(expData[0]) : 'No data');
    }
}

checkSchema();
