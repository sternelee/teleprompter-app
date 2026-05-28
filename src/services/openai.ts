import { DialogueSegment } from '@/types/dialogue';

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4.7-flash';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPrompt(scene: string, previousSegments?: DialogueSegment[]): string {
  const previous = previousSegments?.length
    ? `\n\nPrevious dialogue:\n${previousSegments.map((s) => `${s.speaker === 'ai' ? 'Other' : 'User'}: ${s.text}`).join('\n')}`
    : '';

  return `You are creating English speaking practice dialogue for a language learner.

Scene: ${scene}${previous}

Generate a natural English dialogue for this scene. The dialogue should:
- Be 8-12 lines (4-6 exchanges)
- Use practical, everyday English
- Be appropriate for intermediate English learners
- Include both the user's lines and the other person's lines
- The user's lines should be things the learner can practice speaking aloud

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
  if (trimmed.startsWith('```')) {
    const withoutFence = trimmed.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    return withoutFence;
  }
  return trimmed;
}

export async function generateDialogue(
  scene: string,
  apiKey: string,
  previousSegments?: DialogueSegment[]
): Promise<DialogueSegment[]> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates English practice dialogue.' },
        { role: 'user', content: buildPrompt(scene, previousSegments) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      thinking: { type: 'disenabled' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BigModel API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (!content) {
    const reason = choice?.finish_reason;
    if (reason === 'length') {
      throw new Error('Response truncated: the model ran out of tokens. Try a shorter scene or prompt.');
    }
    throw new Error(`Empty response from BigModel (finish_reason: ${reason || 'unknown'})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch {
    throw new Error(`Invalid JSON from BigModel: ${content.slice(0, 200)}...`);
  }

  const segments: DialogueSegment[] = (parsed.segments || []).map((s: { speaker: string; text: string }) => ({
    id: generateId(),
    speaker: s.speaker === 'user' ? 'user' : 'ai',
    text: s.text,
  }));

  return segments;
}
