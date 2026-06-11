import { DialogueSegment } from "@/types/dialogue";

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPrompt(
  scene: string,
  previousSegments?: DialogueSegment[],
): string {
  const previous = previousSegments?.length
    ? `\n\nPrevious dialogue:\n${previousSegments.map((s) => `${s.speaker === "ai" ? "Partner" : "User"}: ${s.text}`).join("\n")}`
    : "";

  return `You are creating English speaking practice dialogue for a language learner.

Scene: ${scene}${previous}

Generate a natural English dialogue for this scene. The dialogue should:
- Be 8-12 lines (4-6 exchanges)
- Use practical, everyday English
- Be appropriate for intermediate English learners
- Include both the user's lines and the other person's lines
- Mark the learner's lines as "user" and the other person's lines as "ai"
- The user's lines should be useful things the learner can practice speaking aloud
- Keep each line short enough to say in one breath
- Do not include stage directions, translations, markdown, or explanations
- If previous dialogue is provided, continue after the final line without repeating earlier lines

Return ONLY a JSON object in this exact format:
{
  "segments": [
    { "speaker": "ai", "text": "..." },
    { "speaker": "user", "text": "..." },
    ...
  ]
}`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    return withoutFence;
  }
  return trimmed;
}

export async function generateDialogue(
  scene: string,
  apiKey: string,
  previousSegments?: DialogueSegment[],
): Promise<DialogueSegment[]> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates English practice dialogue.",
        },
        { role: "user", content: buildPrompt(scene, previousSegments) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (!content) {
    const reason = choice?.finish_reason;
    if (reason === "length") {
      throw new Error(
        "Response truncated: the model ran out of tokens. Try a shorter scene or prompt.",
      );
    }
    throw new Error(
      `Empty response from DeepSeek (finish_reason: ${reason || "unknown"})`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch {
    throw new Error(`Invalid JSON from DeepSeek: ${content.slice(0, 200)}...`);
  }

  const rawSegments = Array.isArray(parsed.segments) ? parsed.segments : [];
  const segments: DialogueSegment[] = rawSegments
    .filter((s: { text?: unknown }) => typeof s.text === "string" && s.text.trim())
    .map((s: { speaker?: string; text: string }) => ({
      id: generateId(),
      speaker: s.speaker === "user" ? "user" : "ai",
      text: s.text.trim(),
    }));

  if (segments.length === 0) {
    throw new Error(
      "DeepSeek returned an empty dialogue. Try adding more scene details.",
    );
  }

  if (!segments.some((segment) => segment.speaker === "user")) {
    throw new Error(
      "DeepSeek returned no lines for you to practice. Try regenerating the scene.",
    );
  }

  return segments;
}
