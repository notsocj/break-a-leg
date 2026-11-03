# Synthetic fixture: FastAPI chat endpoint with a caller-chosen model and no cap.
from fastapi import FastAPI
from openai import OpenAI

app = FastAPI()
client = OpenAI()


@app.post("/chat")
async def chat(body: dict):
    model = body.get("model")
    result = client.chat.completions.create(model=model, messages=body["messages"])
    return result.choices[0].message
