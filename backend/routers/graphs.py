from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UploadedFile, GraphDefinition
from services.data_processor import DataProcessor
import schemas
import uuid
import pandas as pd

router = APIRouter(prefix="/api/files", tags=["graphs"])
top_router = APIRouter(prefix="/api/graphs", tags=["graphs_top"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{file_id}/graphs")
def get_recommended_graphs(file_id: str, db: Session = Depends(get_db)):
    graphs = db.query(GraphDefinition).filter(GraphDefinition.file_id == file_id).all()
    # Ensure serializable output for JSON
    return graphs

@router.post("/{file_id}/graph-data")
def get_graph_data(
    file_id: str, 
    request: schemas.GraphDataRequest, 
    db: Session = Depends(get_db)
):
    try:
        # 1. Check if the specific graph definition exists and has cached data
        # (This is true for recommended graphs)
        is_custom_query = True
        
        # Try to find if this matches a recommended graph to use cached data
        graph_def = db.query(GraphDefinition).filter(
            GraphDefinition.file_id == file_id,
            GraphDefinition.graph_type == request.graph_type,
            GraphDefinition.x_axis == request.x_axis,
            GraphDefinition.y_axis == request.y_axis,
            GraphDefinition.aggregation == request.aggregation
        ).first()

        if graph_def and graph_def.cached_data:
            print(f"DEBUG: Instant load from DB cache for {file_id}")
            return graph_def.cached_data

        # 2. Dynamic Calculation (Fallback or Custom Query)
        file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file_record.status != "completed":
            raise HTTPException(status_code=400, detail="File processing not complete")

        # Load data (will hit memory cache in DataProcessor)
        try:
            df = DataProcessor.read_file(file_record.file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

        from services.graph_engine import GraphEngine
        result = GraphEngine.get_aggregated_data(
            df, 
            request.graph_type, 
            request.x_axis, 
            request.y_axis, 
            request.aggregation
        )

        return result
    except Exception as e:
        import traceback
        with open("error_log.txt", "a") as f:
            f.write(f"\n\nERROR on {file_id}: {str(e)}\n")
            f.write(traceback.format_exc())
        raise e

@router.post("/{file_id}/query")
def process_natural_language_query(
    file_id: str,
    request: schemas.QueryRequest,
    db: Session = Depends(get_db)
):
    from models import FileColumn
    from services.graph_engine import GraphEngine

    # 1. Fetch file schema
    columns = db.query(FileColumn).filter(FileColumn.file_id == file_id).all()
    if not columns:
        raise HTTPException(status_code=404, detail="Columns not found for this file")

    col_list = [{"name": c.column_name, "type": c.data_type} for c in columns]

    # 2. Parse query
    graph_config = GraphEngine.parse_query(request.prompt, col_list)
    
    if not graph_config["x_axis"]:
        raise HTTPException(
            status_code=400, 
            detail="Could not identify relevant columns in your prompt. Please mention column names clearly."
        )

    # 3. Return the parsed definition
    return {
        "id": f"query-{uuid.uuid4()}",
        "graph_type": graph_config["graph_type"],
        "x_axis": graph_config["x_axis"],
        "y_axis": graph_config["y_axis"],
        "aggregation": graph_config["aggregation"]
    }
@router.post("/{file_id}/save-graph")
def save_custom_graph(
    file_id: str,
    request: schemas.GraphDefinitionCreate,
    db: Session = Depends(get_db)
):
    # Ensure the file exists
    file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Upsert behavior:
    # - If request.id is provided and exists -> update graph (including options like x/y/width/height)
    # - Else -> create a new graph
    if request.id:
        existing = db.query(GraphDefinition).filter(
            GraphDefinition.id == request.id,
            GraphDefinition.file_id == file_id
        ).first()
        if existing:
            existing.graph_type = request.graph_type
            existing.x_axis = request.x_axis
            existing.y_axis = request.y_axis
            existing.aggregation = request.aggregation
            if request.options is not None:
                # Full replace of options coming from the frontend state
                existing.options = request.options
            db.commit()
            db.refresh(existing)
            return existing

    new_graph = GraphDefinition(
        id=request.id or str(uuid.uuid4()),
        file_id=file_id,
        graph_type=request.graph_type,
        x_axis=request.x_axis,
        y_axis=request.y_axis,
        aggregation=request.aggregation,
        options=request.options
    )

    db.add(new_graph)
    db.commit()
    db.refresh(new_graph)

    return new_graph
    
@top_router.delete("/{graph_id}")
def delete_graph(
    graph_id: str,
    db: Session = Depends(get_db)
):
    # Find the graph
    graph = db.query(GraphDefinition).filter(
        GraphDefinition.id == graph_id
    ).first()
    
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
        
    db.delete(graph)
    db.commit()
    
    return {"message": "Graph deleted successfully", "id": graph_id}
