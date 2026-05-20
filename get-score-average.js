require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function getScoreAverage() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be defined in environment variables'
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query the score_employabilité table
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('score_final');

    if (error) {
      throw new Error(`Error fetching data: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('0.00');
      return;
    }

    // Calculate the average of score_final column
    const sum = data.reduce((acc, row) => acc + (row.score_final || 0), 0);
    const average = sum / data.length;

    // Format to 2 decimal places
    const formattedAverage = average.toFixed(2);
    
    console.log(formattedAverage);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getScoreAverage();
