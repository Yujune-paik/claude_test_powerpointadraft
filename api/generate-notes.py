import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """あなたはプレゼンテーションのスピーカーノートを作成するアシスタントです。
発表者の発話の文字起こしテキストを受け取り、整理されたスピーカーノートを生成してください。

ルール:
- 「あー」「えーと」「まあ」などのフィラーは除去する
- 論理的な流れに整理する
- 発話の内容を忠実に反映する（内容を勝手に追加・変更しない）
- 箇条書きではなく、自然な話し言葉ベースのノートとして出力する
- 簡潔で読みやすい文章にする
- スピーカーノートとしてそのまま使えるような形式にする"""


class GenerateRequest(BaseModel):
    slide_text: str
    transcript: str
    model: str = "gpt-4o"


@app.post("/api/generate-notes")
async def generate_notes(request: GenerateRequest):
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    client = OpenAI(api_key=api_key)

    user_message = f"""## 発話の文字起こし
{request.transcript}

上記の発話内容を整理して、このスライドのスピーカーノートを生成してください。"""

    response = client.chat.completions.create(
        model=request.model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return {"note": response.choices[0].message.content}
