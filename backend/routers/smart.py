from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
import pandas as pd
import os
import shutil
from services.smart_analyzer import SmartAnalyzer
from services.data_processor import DataProcessor
import uuid

router = APIRouter(prefix="/api/smart", tags=["smart"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

UPLOAD_DIR = "uploads"

@router.post("/query")
async def process_smart_query(
    file_id: str = Form(None),
    prompt: str = Form(...),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Analyzes data using PandasAI.
    Can accept an existing file_id OR a new file upload.
    """
    df = None
    
    # 1. Handle File Source
    if file:
        # Save temporary file for analysis
        temp_id = uuid.uuid4()
        extension = file.filename.split(".")[-1].lower()
        temp_path = os.path.join(UPLOAD_DIR, f"temp_{temp_id}.{extension}")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            df = DataProcessor.read_file(temp_path)
            # Cleanup temp file
            os.remove(temp_path)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"Error reading uploaded file: {str(e)}")
            
    elif file_id:
        file_record = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        try:
            df = DataProcessor.read_file(file_record.file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading file: {str(e)}")
    
    if df is None:
        raise HTTPException(status_code=400, detail="No data provided for analysis. Please upload a file or specify a file_id.")

    # 2. Analyze with PandasAI
    result = SmartAnalyzer.analyze(df, prompt)
    
    return {
        "status": "success",
        "result": result,
        "file_id": file_id  # Include file_id for history tracking if needed
    }
