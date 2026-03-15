import os
import shutil
import base64
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks, Body
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UploadedFile, FileColumn, ColumnStatistic, User, GraphDefinition
import models
from tasks import run_file_processing
import uuid

router = APIRouter(prefix="/api/files", tags=["files"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks, Form

@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: int = Form(None),  # Get from form, None means not authenticated
    db: Session = Depends(get_db)
):
    # Allow anonymous uploads - user_id is optional
    # If user_id provided, verify user exists
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    
    # Validate file type
    allowed_extensions = ["csv", "xlsx", "xls", "json"]
    extension = file.filename.split(".")[-1].lower()
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    file_id = uuid.uuid4()
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{extension}")

    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create DB record - allow anonymous uploads (user_id can be NULL)
    db_file = UploadedFile(
        id=str(file_id),
        user_id=user_id,  # Will be None for anonymous users
        file_name=file.filename,
        file_path=file_path,
        status="pending"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    # Trigger background task
    background_tasks.add_task(run_file_processing, str(file_id))
    print(f"SUCCESS: Triggered processing for {file_id}" + (f" by user {user_id}" if user_id else " (anonymous)"))

    return {"file_id": file_id, "status": "pending", "message": "File upload successful, processing started"}


@router.get("/{file_id}/schema")
def get_file_schema(file_id: str, db: Session = Depends(get_db)):
    columns = db.query(FileColumn).filter(FileColumn.file_id == file_id).all()
    if not columns:
        # Check if file exists/is processing to distinguish 404 from "still processing"
        file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=400, detail="File still processing")
    
    # We need to serialize columns manually as they are SQLAlchemy objects
    schema_data = [
        {"column_name": c.column_name, "data_type": c.data_type, "null_count": c.null_count, "unique_count": c.unique_count}
        for c in columns
    ]
    return schema_data

@router.get("/{file_id}/statistics")
def get_file_statistics(file_id: str, db: Session = Depends(get_db)):
    columns = db.query(FileColumn).filter(FileColumn.file_id == file_id).all()
    if not columns:
        raise HTTPException(status_code=404, detail=f"File {file_id} not found or columns not processed")
    
    stats = {}
    for col in columns:
        if col.statistics:
            s = col.statistics
            stats[col.column_name] = {
                "min_value": s.min_value,
                "max_value": s.max_value,
                "mean_value": s.mean_value,
                "median_value": s.median_value,
                "std_dev": s.std_dev,
                "top_values": s.top_values
            }
            
    return stats

@router.get("/{file_id}/status")
def get_file_status(file_id: str, db: Session = Depends(get_db)):
    file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    return {
        "status": file_record.status,
        "error": file_record.error_message,
        "row_count": file_record.row_count,
        "fileName": file_record.file_name,
    }

@router.post("/{file_id}/retry-processing")
async def retry_file_processing(
    file_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Re-run processing for an existing uploaded file.
    Useful when processing failed due to missing dependencies or transient errors.
    """
    file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.status == "processing":
        return {"status": "processing", "message": "File is already processing"}

    # Clear previous derived metadata so recomputation is clean.
    db.query(FileColumn).filter(FileColumn.file_id == file_id).delete()
    db.query(GraphDefinition).filter(GraphDefinition.file_id == file_id).delete()
    file_record.status = "pending"
    file_record.error_message = None
    db.commit()

    background_tasks.add_task(run_file_processing, file_id)
    return {"status": "pending", "message": "Retry started"}

@router.get("/user/{user_id}")
def get_user_files(user_id: int, db: Session = Depends(get_db)):
    files = db.query(UploadedFile).filter(UploadedFile.user_id == user_id).order_by(UploadedFile.created_at.desc()).all()
    
    result = []
    for f in files:
        viz_count = db.query(GraphDefinition).filter(GraphDefinition.file_id == f.id).count()
        result.append({
            "id": f.id,
            "fileName": f.file_name,
            "uploadDate": f.created_at.strftime("%Y-%m-%d"),
            "recordCount": f.row_count,
            "visualizations": viz_count,
            "status": f.status
        })
    return result

@router.get("/user/{user_id}/activity")
def get_user_activity(user_id: int, db: Session = Depends(get_db)):
    files = db.query(UploadedFile).filter(UploadedFile.user_id == user_id).order_by(UploadedFile.created_at.desc()).limit(10).all()
    
    activities = []
    for f in files:
        activities.append({
            "id": f.id,
            "fileId": f.id,
            "action": f"Uploaded {f.file_name}",
            "timestamp": f.created_at.strftime("%Y-%m-%d %H:%M")
        })
        
        graphs = db.query(GraphDefinition).filter(GraphDefinition.file_id == f.id).order_by(GraphDefinition.id.desc()).all()
        for g in graphs:
            activities.append({
                "id": f"g-{g.id}",
                "fileId": f.id,
                "action": f"Generated {g.graph_type} for {f.file_name}",
                "timestamp": f.created_at.strftime("%Y-%m-%d %H:%M")
            })
            
    return sorted(activities, key=lambda x: x["timestamp"], reverse=True)[:40]

@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db)):
    """Download file content (handles both text and binary files)"""
    file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    try:
        file_ext = file_record.file_name.split('.')[-1].lower()
        
        # Try UTF-8 text reading first (for CSV, JSON)
        if file_ext in ['csv', 'json', 'txt']:
            try:
                with open(file_record.file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {"content": content, "fileName": file_record.file_name, "isText": True}
            except UnicodeDecodeError:
                # Fall through to binary handling
                pass
        
        # Handle binary files (xlsx, xls) with base64 encoding
        with open(file_record.file_path, 'rb') as f:
            file_bytes = f.read()
            encoded_content = base64.b64encode(file_bytes).decode('utf-8')
        return {"content": encoded_content, "fileName": file_record.file_name, "isText": False, "isBase64": True}
    except Exception as e:
        print(f"ERROR downloading file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.delete("/{file_id}")
def delete_file(file_id: str, db: Session = Depends(get_db)):
    file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Optional: Delete physical file if it exists
    if file_record.file_path and os.path.exists(file_record.file_path):
        os.remove(file_record.file_path)
        
    db.query(GraphDefinition).filter(GraphDefinition.file_id == file_id).delete()
    db.delete(file_record)
    db.commit()
    return {"message": "File deleted successfully"}


@router.post("/{file_id}/save-as")
def save_as_file(
    file_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Create a new file entry duplicating an existing report (data + derived metadata + graphs),
    but with a new name. Returns the new file_id.
    """
    new_name = (payload.get("fileName") or payload.get("file_name") or "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="fileName is required")

    src = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Source file not found")

    if not src.file_path or not os.path.exists(src.file_path):
        raise HTTPException(status_code=404, detail="Source file not found on disk")

    # Preserve extension from the original filename/path
    extension = (src.file_name.split(".")[-1] if "." in src.file_name else "").lower()
    if not extension:
        # Fallback to file_path extension
        extension = os.path.splitext(src.file_path)[1].lstrip(".").lower()

    new_id = str(uuid.uuid4())
    new_path = os.path.join(UPLOAD_DIR, f"{new_id}.{extension}") if extension else os.path.join(UPLOAD_DIR, f"{new_id}")

    try:
        shutil.copy2(src.file_path, new_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to copy file: {str(e)}")

    # Create new UploadedFile record
    dst = UploadedFile(
        id=new_id,
        user_id=src.user_id,
        file_name=new_name,
        file_path=new_path,
        row_count=src.row_count,
        column_count=src.column_count,
        status=src.status if src.status else "completed",
        error_message=None
    )
    db.add(dst)
    db.flush()  # ensure dst is present for FK constraints

    # Duplicate columns + statistics
    src_columns = db.query(FileColumn).filter(FileColumn.file_id == file_id).all()
    for c in src_columns:
        new_col = FileColumn(
            file_id=new_id,
            column_name=c.column_name,
            data_type=c.data_type,
            null_count=c.null_count,
            unique_count=c.unique_count
        )
        db.add(new_col)
        db.flush()

        if c.statistics:
            s = c.statistics
            new_stat = ColumnStatistic(
                column_id=new_col.id,
                min_value=s.min_value,
                max_value=s.max_value,
                mean_value=s.mean_value,
                median_value=s.median_value,
                std_dev=s.std_dev,
                top_values=s.top_values
            )
            db.add(new_stat)

    # Duplicate graphs
    src_graphs = db.query(GraphDefinition).filter(GraphDefinition.file_id == file_id).all()
    for g in src_graphs:
        new_graph = GraphDefinition(
            file_id=new_id,
            graph_type=g.graph_type,
            x_axis=g.x_axis,
            y_axis=g.y_axis,
            aggregation=g.aggregation,
            cached_data=g.cached_data,
            options=g.options
        )
        db.add(new_graph)

    db.commit()
    return {"file_id": new_id, "fileName": new_name}
