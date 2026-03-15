from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, BackgroundTasks
from sqlalchemy.orm import Session
from database import SessionLocal, engine as local_engine
import models, schemas
from services.sql_engine import SQLEngine
from services.data_processor import DataProcessor
import os
import shutil
import uuid
import pandas as pd
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/api/sql", tags=["sql"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_sql_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """
    Uploads a .sql file, executes its commands on the local DB in background, 
    and returns a file_id for visualization.
    """
    if not file.filename.endswith(".sql"):
        raise HTTPException(status_code=400, detail="Only .sql files are allowed.")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.sql")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Create a record in UploadedFile to track this file
        db_file = models.UploadedFile(
            id=file_id,
            user_id=user_id,
            file_name=file.filename,
            file_path=file_path,
            status="pending" # Set to pending for background processing
        )
        db.add(db_file)
        db.commit()
        
        # Trigger background task for SQL processing (needs to be implemented in tasks.py)
        from tasks import run_sql_processing
        background_tasks.add_task(run_sql_processing, file_id)
        
        return {"file_id": file_id, "status": "pending", "message": "SQL script uploaded, processing started."}
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"SQL upload failed: {str(e)}")

@router.post("/connect")
async def connect_external_db(
    user_id: int = Form(...),
    connection_name: str = Form(...),
    db_type: str = Form("postgresql"),
    host: str = Form("localhost"),
    port: int = Form(5432),
    database: str = Form(...),
    username: str = Form(""),
    password: str = Form(""),
    db: Session = Depends(get_db)
):
    """
    Saves external database credentials and tests connection.
    """
    db_config = {
        "db_type": db_type,
        "host": host,
        "port": port,
        "database": database,
        "username": username,
        "password": password
    }
    
    try:
        ext_engine = SQLEngine.get_external_db_engine(db_config)
        with ext_engine.connect() as conn:
            pass # Test connection
            
        # Save connection info
        db_conn = models.UserDatabaseConnection(
            user_id=user_id,
            connection_name=connection_name,
            db_type=db_type,
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        db.add(db_conn)
        db.commit()
        db.refresh(db_conn)
        
        return {"connection_id": db_conn.id, "message": "Connection successful and saved."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database connection failed: {str(e)}")

@router.post("/query")
async def execute_visualization_query(
    query: str = Form(...),
    connection_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Executes a SELECT query on either an external DB or the local DB.
    """
    try:
        if connection_id:
            conn_record = db.query(models.UserDatabaseConnection).filter(models.UserDatabaseConnection.id == connection_id).first()
            if not conn_record:
                raise HTTPException(status_code=404, detail="Connection not found")
            
            db_config = {
                "db_type": conn_record.db_type,
                "host": conn_record.host,
                "port": conn_record.port,
                "database": conn_record.database,
                "username": conn_record.username,
                "password": conn_record.password
            }
            target_engine = SQLEngine.get_external_db_engine(db_config)
        else:
            target_engine = local_engine
            
        df = SQLEngine.execute_query(query, target_engine)
        
        # Prepare visualization data
        col_types = SQLEngine.infer_column_types(df)
        
        # Try to find a good X and Y axis
        numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
        categorical_cols = [c for c, t in col_types.items() if t == "categorical"]
        
        x_axis = categorical_cols[0] if categorical_cols else df.columns[0]
        y_axis = numeric_cols[0] if numeric_cols else None
        
        chart_data = SQLEngine.format_for_charts(df, x_axis, y_axis)
        
        return {
            "status": "success",
            "columns": [{"name": c, "type": t} for c, t in col_types.items()],
            "data": chart_data,
            "preview": df.head(10).to_dict(orient="records"),
            "suggested_axes": {"x": x_axis, "y": y_axis}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.post("/visualize")
async def save_sql_as_dataset(
    background_tasks: BackgroundTasks,
    query: str = Form(...),
    user_id: int = Form(...),
    connection_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Executes a SQL query, saves the result as a CSV, and creates a dataset for analytics.
    """
    try:
        if connection_id:
            conn_record = db.query(models.UserDatabaseConnection).filter(models.UserDatabaseConnection.id == connection_id).first()
            if not conn_record:
                raise HTTPException(status_code=404, detail="Connection not found")
            
            db_config = {
                "db_type": conn_record.db_type,
                "host": conn_record.host,
                "port": conn_record.port,
                "database": conn_record.database,
                "username": conn_record.username,
                "password": conn_record.password
            }
            target_engine = SQLEngine.get_external_db_engine(db_config)
        else:
            target_engine = local_engine
            
        # 1. Execute the query
        df = SQLEngine.execute_query(query, target_engine)
        
        if df.empty:
             raise HTTPException(status_code=400, detail="The query returned no data. Cannot visualize an empty result.")

        # 2. Save as CSV
        file_id = str(uuid.uuid4())
        file_name = f"sql_query_{file_id[:8]}.csv"
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.csv")
        df.to_csv(file_path, index=False)
        
        # 3. Create UploadedFile record
        db_file = models.UploadedFile(
            id=file_id,
            user_id=user_id,
            file_name=file_name,
            file_path=file_path,
            status="pending",
            row_count=len(df),
            column_count=len(df.columns)
        )
        db.add(db_file)
        db.commit()
        
        # 4. Trigger background processing
        from tasks import run_file_processing
        background_tasks.add_task(run_file_processing, file_id)
        
        return {"file_id": file_id, "status": "pending", "message": "SQL query results saved as dataset, processing started."}
        
    except Exception as e:
        print(f"SQL Visualize Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/aggregate")
async def aggregate_sql_results(
    query: str = Form(...),
    x_axis: str = Form(...),
    y_axis: Optional[str] = Form(None),
    aggregation: str = Form("sum"),
    connection_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Aggregates results of an existing SQL query for chart visualization.
    Uses subqueries to avoid complex parsing.
    """
    try:
        if connection_id:
            conn_record = db.query(models.UserDatabaseConnection).filter(models.UserDatabaseConnection.id == connection_id).first()
            if not conn_record:
                raise HTTPException(status_code=404, detail="Connection not found")
            
            db_config = {
                "db_type": conn_record.db_type,
                "host": conn_record.host,
                "port": conn_record.port,
                "database": conn_record.database,
                "username": conn_record.username,
                "password": conn_record.password
            }
            target_engine = SQLEngine.get_external_db_engine(db_config)
        else:
            target_engine = local_engine
            
        # Optimization: Don't fetch ALL data, use SQL to aggregate!
        # Wrap the original query in a subquery
        y_clause = ""
        if y_axis:
            if aggregation == "sum":
                y_clause = f"SUM({y_axis})"
            elif aggregation == "mean":
                y_clause = f"AVG({y_axis})"
            elif aggregation == "count":
                y_clause = f"COUNT({y_axis})"
            elif aggregation == "max":
                y_clause = f"MAX({y_axis})"
            elif aggregation == "min":
                y_clause = f"MIN({y_axis})"
            else:
                y_clause = f"SUM({y_axis})"
        else:
            y_clause = "COUNT(*)"

        agg_query = f"""
            SELECT {x_axis} AS label, {y_clause} AS value
            FROM ({query}) AS subquery
            GROUP BY {x_axis}
            ORDER BY value DESC
            LIMIT 50
        """
        
        df = SQLEngine.execute_query(agg_query, target_engine)
        
        return {
            "labels": [str(v) for v in df["label"].tolist()],
            "values": [float(v) if pd.notna(v) else None for v in df["value"].tolist()]
        }
    except Exception as e:
        print(f"Aggregation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Aggregation failed: {str(e)}")

@router.get("/connections/{user_id}")
async def get_user_connections(user_id: int, db: Session = Depends(get_db)):
    connections = db.query(models.UserDatabaseConnection).filter(models.UserDatabaseConnection.user_id == user_id).all()
    return connections

@router.post("/dataverse")
async def connect_dataverse(
    background_tasks: BackgroundTasks,
    request: schemas.DataverseConnectionRequest,
    db: Session = Depends(get_db)
):
    """
    Connects to Dataverse via Server-to-Server authentication,
    fetches the specified table, and converts it into a dataset.
    """
    try:
        import msal
        import requests
        
        # Clean up URL
        env_url = request.environment_url.rstrip('/')
        if not env_url.startswith('https://'):
            env_url = 'https://' + env_url
            
        authority = f"https://login.microsoftonline.com/{request.tenant_id}"
        app = msal.ConfidentialClientApplication(
            request.client_id,
            authority=authority,
            client_credential=request.client_secret,
        )
        
        # Scope is the environment URL + /.default
        scope = [f"{env_url}/.default"]
        
        # Acquire token
        result = app.acquire_token_for_client(scopes=scope)
        if "access_token" not in result:
            error_msg = result.get("error_description", result.get("error", "Unknown MSAL Error"))
            raise HTTPException(status_code=401, detail=f"Authentication failed: {error_msg}")
            
        access_token = result["access_token"]
        
        # Fetch data from Dataverse OData API
        # Only fetching top 5000 rows for performance in this integration
        headers = {
            "Authorization": f"Bearer {access_token}",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "Accept": "application/json",
            "Prefer": "odata.maxpagesize=5000"
        }
        
        api_url = f"{env_url}/api/data/v9.2/{request.table_name}"
        response = requests.get(api_url, headers=headers)
        
        if not response.ok:
            raise HTTPException(status_code=response.status_code, detail=f"Dataverse API Error: {response.text}")
            
        data = response.json().get('value', [])
        if not data:
            raise HTTPException(status_code=404, detail=f"Table '{request.table_name}' returned no data.")
            
        # Convert to Pandas DataFrame
        df = pd.DataFrame(data)
        
        # Remove OData metadata columns that start with '@'
        cols_to_keep = [c for c in df.columns if not c.startswith('@')]
        df = df[cols_to_keep]
        
        # Save as CSV
        file_id = str(uuid.uuid4())
        file_name = f"dataverse_{request.table_name}_{file_id[:8]}.csv"
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.csv")
        df.to_csv(file_path, index=False)
        
        # Create UploadedFile record
        db_file = models.UploadedFile(
            id=file_id,
            user_id=request.user_id,
            file_name=file_name,
            file_path=file_path,
            status="pending",
            row_count=len(df),
            column_count=len(df.columns)
        )
        db.add(db_file)
        db.commit()
        
        # Trigger background processing
        from tasks import run_file_processing
        background_tasks.add_task(run_file_processing, file_id)
        
        return {
            "file_id": file_id, 
            "status": "pending", 
            "message": f"Successfully pulled {len(df)} rows from {request.table_name}."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Dataverse Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
