export async function parseActions(text) {
  try {
    const res = await fetch('http://192.168.29.141:11434/v1/chat/completions', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        response_format: { type: "json_object" },
        messages: [
          { 
            role: "system", 
            content: "You are a strict task parser. Extract the core task, the time, and whether an alarm is needed. Output ONLY a JSON object with this exact structure: { 'task': 'Cleaned up task name', 'time_24h': 'HH:MM string or null', 'set_alarm': boolean }" 
          },
          { role: "user", content: text }
        ],
        temperature: 0.1
      })
    });
    
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Local Ollama Server unreachable:", error);
    return null;
  }
}