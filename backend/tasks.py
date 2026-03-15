import os
import pandas as pd
from database import SessionLocal
from models import UploadedFile, FileColumn, ColumnStatistic, GraphDefinition
from services.data_processor import DataProcessor
from services.graph_engine import GraphEngine
import uuid

import concurrent.futures


def run_file_processing(file_id: str):
    print(f"DEBUG: Processing file: {file_id}")
    db = SessionLocal()
    try:
        file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not file_record:
            return "File record not found"

        file_record.status = "processing"
        db.commit()

        # Load file
        print(f"DEBUG: Reading file from path: {file_record.file_path}")
        df = DataProcessor.read_file(file_record.file_path)
        
        file_record.row_count = len(df)
        file_record.column_count = len(df.columns)
        
        print(f"DEBUG: Inferring types for {len(df.columns)} columns")
        col_types = DataProcessor.infer_column_types(df)
        
        column_configs = []
        
        # Parallelize Column Stats Calculation
        print(f"DEBUG: Calculating column stats in parallel")
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Map column name to future
            future_to_col = {
                executor.submit(DataProcessor.get_column_stats, df, col, dtype): (col, dtype)
                for col, dtype in col_types.items()
            }
            
            # Process results as they complete (or just iterate)
            results = []
            for future in concurrent.futures.as_completed(future_to_col):
                col_name, col_type = future_to_col[future]
                try:
                    stats = future.result()
                    results.append((col_name, col_type, stats))
                except Exception as exc:
                    print(f"WARNING: Stats calculation failed for {col_name}: {exc}")

        # Write stats to DB (Sequential to avoid locking/session issues)
        for col_name, col_type, stats in results:
            db_column = FileColumn(
                file_id=file_record.id,
                column_name=col_name,
                data_type=col_type,
                null_count=stats["null_count"],
                unique_count=stats["unique_count"]
            )
            db.add(db_column)
            db.flush() # Get ID for stats

            db_stats = ColumnStatistic(
                column_id=db_column.id,
                min_value=stats.get("min_value"),
                max_value=stats.get("max_value"),
                mean_value=stats.get("mean_value"),
                median_value=stats.get("median_value"),
                std_dev=stats.get("std_dev"),
                top_values=stats.get("top_values")
            )
            db.add(db_stats)
            column_configs.append({"name": col_name, "type": col_type})

        # Recommendations
        print(f"DEBUG: Generating graph recommendations")
        recommendations = GraphEngine.recommend_graphs(column_configs)
        
        # Limit to top 10 recommendations
        top_recommendations = recommendations[:10]
        
        # Parallelize Graph Data Pre-calculation
        print(f"DEBUG: Pre-calculating graph data in parallel")
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_to_rec = {
                executor.submit(
                    GraphEngine.get_aggregated_data, 
                    df, 
                    rec["graph_type"], 
                    rec["x_axis"], 
                    rec["y_axis"], 
                    rec["aggregation"]
                ): rec
                for rec in top_recommendations
            }
            
            for future in concurrent.futures.as_completed(future_to_rec):
                rec = future_to_rec[future]
                graph_data = None
                try:
                    graph_data = future.result()
                except Exception as e:
                    print(f"WARNING: Could not pre-calculate data for graph: {e}")
                
                # Add to DB immediately (session is thread-local but we are in main thread loop here)
                db_graph = GraphDefinition(
                    file_id=file_record.id,
                    graph_type=rec["graph_type"],
                    x_axis=rec["x_axis"],
                    y_axis=rec["y_axis"],
                    aggregation=rec["aggregation"],
                    cached_data=graph_data
                )
                db.add(db_graph)

        file_record.status = "completed"
        db.commit()
        print(f"DEBUG: Successfully processed {file_id}")
        return f"Processed {file_id} successfully"

    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to process {file_id}: {str(e)}")
        file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if file_record:
            file_record.status = "failed"
            file_record.error_message = str(e)
            db.commit()
        return f"Error processing {file_id}: {str(e)}"
    finally:
        db.close()

def run_sql_processing(file_id: str):
    print(f"DEBUG: Processing SQL file: {file_id}")
    from services.sql_engine import SQLEngine
    from database import engine as local_engine
    import sqlalchemy
    from sqlalchemy import inspect
    
    db = SessionLocal()
    try:
        file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not file_record:
            return "File record not found"

        file_record.status = "processing"
        db.commit()

        # 1. Execute SQL Commands
        print(f"DEBUG: Parsing and executing SQL from {file_record.file_path}")
        commands = SQLEngine.parse_sql_file(file_record.file_path)
        SQLEngine.execute_on_local_db(commands, local_engine)

        # 2. Heuristically find the primary table to analyze
        # We look for tables that are NOT internal system tables and have data
        inspector = inspect(local_engine)
        table_names = inspector.get_table_names()
        
        # Exclude app's own tables
        app_tables = ["users", "uploaded_files", "file_columns", "column_statistics", "graph_definitions", "user_db_connections"]
        candidate_tables = [t for t in table_names if t not in app_tables]
        
        if not candidate_tables:
            # If no new tables, maybe it modified existing ones? 
            # For now, let's assume one of the candidate tables is the target.
            raise ValueError("No data tables found after SQL execution.")

        # Find the table with data (preferring the one with most data if multiple)
        primary_table = None
        max_rows = -1
        
        for table in candidate_tables:
            try:
                row_count = db.execute(sqlalchemy.text(f"SELECT COUNT(*) FROM {table}")).scalar()
                if row_count > max_rows:
                    max_rows = row_count
                    primary_table = table
            except:
                continue

        if not primary_table:
            raise ValueError("Could not find any filled tables in the SQL script.")

        file_record.row_count = max_rows
        print(f"DEBUG: Identified primary table '{primary_table}' with {max_rows} rows")

        # 3. Extract metadata from the primary table
        # We can use a SELECT * query with LIMIT 0 to get column names or use inspector
        df = pd.read_sql_table(primary_table, local_engine)
        file_record.column_count = len(df.columns)
        
        col_types = SQLEngine.infer_column_types(df)
        column_configs = []
        
        # Calculate stats and save columns (Similar to run_file_processing)
        for col_name, col_type in col_types.items():
            stats = DataProcessor.get_column_stats(df, col_name, col_type)
            
            db_column = FileColumn(
                file_id=file_record.id,
                column_name=col_name,
                data_type=col_type,
                null_count=stats["null_count"],
                unique_count=stats["unique_count"]
            )
            db.add(db_column)
            db.flush()

            db_stats = ColumnStatistic(
                column_id=db_column.id,
                min_value=stats.get("min_value"),
                max_value=stats.get("max_value"),
                mean_value=stats.get("mean_value"),
                median_value=stats.get("median_value"),
                std_dev=stats.get("std_dev"),
                top_values=stats.get("top_values")
            )
            db.add(db_stats)
            column_configs.append({"name": col_name, "type": col_type})

        # 4. Generate Recommendations
        recommendations = GraphEngine.recommend_graphs(column_configs)
        
        for rec in recommendations[:10]:
            graph_data = None
            try:
                graph_data = GraphEngine.get_aggregated_data(
                    df, 
                    rec["graph_type"], 
                    rec["x_axis"], 
                    rec["y_axis"], 
                    rec["aggregation"]
                )
            except Exception as e:
                print(f"WARNING: Could not calc graph data for SQL: {e}")
            
            db_graph = GraphDefinition(
                file_id=file_record.id,
                graph_type=rec["graph_type"],
                x_axis=rec["x_axis"],
                y_axis=rec["y_axis"],
                aggregation=rec["aggregation"],
                cached_data=graph_data
            )
            db.add(db_graph)

        file_record.status = "completed"
        db.commit()
        print(f"DEBUG: Successfully processed SQL {file_id}")
        return f"Processed SQL {file_id} successfully"

    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to process SQL {file_id}: {str(e)}")
        file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if file_record:
            file_record.status = "failed"
            file_record.error_message = str(e)
            db.commit()
        return f"Error processing SQL {file_id}: {str(e)}"
    finally:
        db.close()
