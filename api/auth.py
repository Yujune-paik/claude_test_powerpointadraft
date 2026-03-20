import os
import hashlib
import hmac
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthRequest(BaseModel):
    password: str


@app.post("/api/auth")
async def auth(request: AuthRequest):
    site_password = os.environ.get("SITE_PASSWORD", "")
    if not site_password:
        return {"ok": False, "error": "SITE_PASSWORD not configured"}

    if hmac.compare_digest(request.password, site_password):
        return {"ok": True}
    else:
        return {"ok": False, "error": "パスワードが違います"}
