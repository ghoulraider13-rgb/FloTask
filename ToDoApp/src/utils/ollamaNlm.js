/**
 * Ollama-based Natural Language Model client for FloTask.
 * Calls local Ollama server at http://192.168.29.141:11434/v1/chat/completions
 * using the qwen2.5:3b model. Outputs structured JSON with task, time_24h, and set_alarm.
 *
 * Usage: import { parseOllamaTask } from './ollamaNlm'
 *        const result = await parseOllamaTask('walk the dog at 6am')
 *        // result = { task: 'Walk the Dog', time_24h: '06:00', set_alarm: true }
 */

export async function parseOllamaTask(userInput) {
  try {
    const response = await fetch(`http://192.168.29.141:11434/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        messages: [
          {
            role: "system",
            content: "You are a natural-language task parser for a task manager app. Output ONLY a JSON object with exactly these three fields: task (string, title-case imperative), time_24h (string in HH:MM 24-hour format, or null if no time mentioned), set_alarm (boolean, true if a time was mentioned and it's an alarm/reminder, false otherwise). No conversational text, no markdown fences, no extra keys."
          },
          {
            role: "user",
            content: userInput
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Strip any potential markdown fences
    const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // If JSON parse fails, try to extract JSON object from the text
      const match = cleaned.match(/\\{([^}]+)\\}/);
      if (match) {
        try {
          parsed = JSON.parse('{' + match[1] + '}');
        } catch (e2) {
          throw new Error(`Ollama returned invalid JSON: ${cleaned}`);
        }
      } else {
        throw new Error(`Ollama returned invalid JSON: ${cleaned}`);
      }
    }

    // Validate required fields
    if (!parsed.task || !parsed.time_24h || parsed.set_alarm === undefined) {
      throw new Error(`Ollama JSON missing required fields. Got: ${JSON.stringify(parsed)}`);
    }

    return {
      task: String(parsed.task).trim(),
      time_24h: parsed.time_24h ? String(parsed.time_24h).trim() : null,
      set_alarm: Boolean(parsed.set_alarm)
    };

  } catch (error) {
    console.error("Ollama NLM error:", error);
    return null;
  }
}

/**
 * Parse a free-form sentence into a task/alarm object using Ollama.
 * Returns { task: string, time_24h: string|null, set_alarm: boolean }
 */
export async function parseActions(text) {
  const result = await parseOllamaTask(text);
  if (!result) return null;

  // Normalize intensity based on whether dueDateTime is set
  const intensity = result.time_24h !== null ? 'medium' : 'low';

  return {
    type: 'task',
    title: result.task,
    dueDateTime: result.time_24h,  // HH:MM local time, no timezone suffix
    priority: 'Low',
    intensity: intensity
  };
}