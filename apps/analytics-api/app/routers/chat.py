from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text

from ..services import ai_service
from .. import database

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    store_id: str
    message: str
    session_id: str | None = None
    history: list[ChatMessage] = []


@router.get("/suggestions")
def suggestions():
    return {"questions": ai_service.get_suggested_questions()}


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    Streaming chat — ส่งกลับเป็น text/plain chunks
    Frontend อ่านด้วย fetch + ReadableStream (หรือ Vercel AI SDK)
    """
    history = [{"role": m.role, "content": m.content} for m in req.history]

    async def generate():
        full_response = ""
        async for chunk in ai_service.stream_chat(req.store_id, req.message, history):
            full_response += chunk
            yield chunk

        # บันทึกลง DB หลังจบ stream
        if req.session_id:
            _save_messages(req.session_id, req.message, full_response)

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


@router.post("/sessions")
def create_session(store_id: str, user_id: str | None = None):
    q = text("""
        INSERT INTO chat_sessions (store_id, user_id)
        VALUES (:store_id, :user_id)
        RETURNING id, title, created_at
    """)
    with database.engine.begin() as conn:
        row = conn.execute(q, {"store_id": store_id, "user_id": user_id}).mappings().first()
    return dict(row)


@router.get("/sessions")
def list_sessions(store_id: str):
    q = text("""
        SELECT id, title, created_at
        FROM chat_sessions
        WHERE store_id = :store_id
        ORDER BY created_at DESC
        LIMIT 50
    """)
    with database.engine.connect() as conn:
        rows = conn.execute(q, {"store_id": store_id}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: str):
    q = text("""
        SELECT role, content, created_at
        FROM chat_messages
        WHERE session_id = :sid
        ORDER BY created_at ASC
    """)
    with database.engine.connect() as conn:
        rows = conn.execute(q, {"sid": session_id}).mappings().all()
    return [dict(r) for r in rows]


def _save_messages(session_id: str, user_msg: str, assistant_msg: str):
    q = text("""
        INSERT INTO chat_messages (session_id, role, content)
        VALUES (:sid, 'user', :user_msg), (:sid, 'assistant', :assistant_msg)
    """)
    try:
        with database.engine.begin() as conn:
            conn.execute(q, {"sid": session_id, "user_msg": user_msg, "assistant_msg": assistant_msg})
    except Exception as e:
        print(f"save message error: {e}")
