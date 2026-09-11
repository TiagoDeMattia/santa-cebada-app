from fastapi import APIRouter, Body, UploadFile, File, Form, HTTPException, Depends
from typing import Optional

from ..services import carta_ia_service as svc
from ..middleware.auth import get_current_user, TokenPayload

router = APIRouter(prefix="/carta-ia", tags=["carta-ia"])


def _admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    return user


@router.get("/docs")
def list_docs(user: TokenPayload = Depends(get_current_user)):
    return svc.get_docs()


@router.get("/docs/{doc_id}")
def get_doc(doc_id: int, user: TokenPayload = Depends(get_current_user)):
    doc = svc.get_doc(doc_id)
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    return doc


@router.post("/docs")
async def create_doc(
    titulo: str = Form(...),
    tipo: str = Form("general"),
    file: Optional[UploadFile] = File(None),
    user: TokenPayload = Depends(_admin),
):
    by = user.nombre or user.sub
    if file and file.filename:
        content = await file.read()
        try:
            texto = svc.extract_text(content, file.filename)
        except ValueError as e:
            raise HTTPException(400, str(e))
        return svc.create_doc(titulo, tipo, texto, file.filename, file.content_type, by)
    return svc.create_doc(titulo, tipo, "", None, None, by)


@router.put("/docs/{doc_id}")
def update_doc(
    doc_id: int,
    body: dict = Body(...),
    user: TokenPayload = Depends(_admin),
):
    by = user.nombre or user.sub
    doc = svc.update_doc(
        doc_id,
        titulo=body.get("titulo"),
        tipo=body.get("tipo"),
        contenido=body.get("contenido"),
        updated_by=by,
    )
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    return doc


@router.post("/docs/{doc_id}/file")
async def replace_file(
    doc_id: int,
    file: UploadFile = File(...),
    user: TokenPayload = Depends(_admin),
):
    content = await file.read()
    by = user.nombre or user.sub
    try:
        doc = svc.replace_file(doc_id, content, file.filename, file.content_type or "", by)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    return doc


@router.post("/docs/{doc_id}/toggle")
def toggle_active(doc_id: int, user: TokenPayload = Depends(_admin)):
    doc = svc.toggle_active(doc_id)
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    return doc


@router.delete("/docs/{doc_id}")
def delete_doc(doc_id: int, user: TokenPayload = Depends(_admin)):
    if not svc.delete_doc(doc_id):
        raise HTTPException(404, "Documento no encontrado")
    return {"success": True}


@router.post("/chat")
def chat(body: dict = Body(...), user: TokenPayload = Depends(get_current_user)):
    pregunta = (body.get("pregunta") or "").strip()
    if not pregunta:
        raise HTTPException(400, "La pregunta no puede estar vacía")
    return {"respuesta": svc.chat(pregunta)}
