# Synthetic fixture: FastAPI chat endpoint behind slowapi with a fixed model and cap.
from fastapi import FastAPI, Request
from openai import OpenAI
from slowapi import Limiter
from slowapi.util import get_remote_address

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
client = OpenAI()


@app.post("/chat")
@limiter.limit("10/minute")
async def chat(request: Request, body: dict):
    result = client.chat.completions.create(model="gpt-4o-mini", max_tokens=400, messages=body["messages"])
    return result.choices[0].message
