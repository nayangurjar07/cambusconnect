const fs = require('fs');

const data = fs.readFileSync('C:\\Users\\07nay\\.gemini\\antigravity-ide\\brain\\b36ebbb0-5bc7-457b-aa5a-4864c58eca07\\.system_generated\\logs\\transcript.jsonl', 'utf-8');
const lines = data.split('\n').filter(l => l.trim().length > 0);
for (const line of lines) {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
            if (tc.function.name === 'default_api:view_file' && tc.function.arguments) {
                const args = JSON.parse(tc.function.arguments);
                if (args.AbsolutePath && args.AbsolutePath.includes('driverhome.js')) {
                    // Check output of this step
                    // But output is in a different step (tool response)
                }
            }
        }
    }
    if (obj.type === 'TOOL_RESPONSE' && obj.content && obj.content.includes('driver/driverhome.js - Driver Portal Logic')) {
        console.log("Found in tool response!");
    }
}
