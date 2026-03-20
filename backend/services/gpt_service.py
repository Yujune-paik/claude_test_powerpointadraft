from openai import OpenAI

SYSTEM_PROMPT = """あなたはプレゼンテーションのスピーカーノートを作成するアシスタントです。
発表者のアドリブ発話の文字起こしテキストと、該当スライドの内容テキストを受け取り、
整理されたスピーカーノートを生成してください。

ルール:
- 「あー」「えーと」「まあ」などのフィラーは除去する
- 論理的な流れに整理する
- スライドに書かれていない補足情報（発話に含まれるもの）は保持する
- 箇条書きではなく、自然な話し言葉ベースのノートとして出力する
- 簡潔で読みやすい文章にする
- スピーカーノートとしてそのまま使えるような形式にする"""


def generate_speaker_note(
    slide_text: str,
    transcript: str,
    api_key: str,
    model: str = "gpt-4o",
) -> str:
    """Generate a speaker note from slide text and transcript using GPT."""
    client = OpenAI(api_key=api_key)

    user_message = f"""## スライドの内容
{slide_text}

## 発話の文字起こし
{transcript}

上記をもとに、このスライドのスピーカーノートを生成してください。"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content
