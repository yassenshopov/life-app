/**
 * One-time script to link existing calendar events to people based on title matching
 * Run this once to populate the event_people junction table
 * 
 * IMPORTANT: This script requires authentication. You have two options:
 * 
 * Option 1: Run from browser console (recommended)
 * 1. Open your app in the browser and log in
 * 2. Open browser console (F12)
 * 3. Copy and paste the code below (the linkEvents function)
 * 
 * Option 2: Use the API directly
 * Make a POST request to /api/events/link-people with:
 * Body: { "timeMin": "2024-01-01T00:00:00Z", "timeMax": "2025-12-31T23:59:59Z" }
 * 
 * Option 3: Add a button in the UI to trigger this
 */

// Code to run in browser console:
const linkEventsInBrowser = `
async function linkEventsToPeople() {
  const timeMin = new Date();
  timeMin.setFullYear(timeMin.getFullYear() - 1);
  const timeMax = new Date();
  timeMax.setFullYear(timeMax.getFullYear() + 1);

  try {
    const response = await fetch('/api/events/link-people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(\`Linked \${data.linked} events to people\`);
      console.log(\`Total events processed: \${data.totalEvents}\`);
      if (data.errors && data.errors.length > 0) {
        console.log(\`\\n⚠️  \${data.errors.length} errors occurred:\`);
        data.errors.forEach((error, idx) => {
          console.log(\`  \${idx + 1}. \${error}\`);
        });
      }
    } else {
      console.error('❌ Error:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

linkEventsToPeople();
`;

console.log('='.repeat(60));
console.log('EVENT-PEOPLE LINKING SCRIPT');
console.log('='.repeat(60));
console.log('\nThis script requires authentication.');
console.log('\nTo use it, copy and paste this code into your browser console:');
console.log('(Make sure you are logged in to your app first)\n');
console.log(linkEventsInBrowser);
console.log('\n' + '='.repeat(60));
console.log('\nAlternatively, you can:');
console.log('1. Add a button in the UI to trigger the API endpoint');
console.log('2. Use a tool like Postman/curl with your auth cookies');
console.log('3. Call the API endpoint programmatically from your app\n');
