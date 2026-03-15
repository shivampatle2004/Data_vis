import os
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
import threading
import time

class DataProcessor:
    # Class-level cache for DataFrames: {file_path: (dataframe, timestamp, last_modified)}
    _df_cache = {}
    _cache_lock = threading.Lock()
    _MAX_CACHE_SIZE = 5 # Store up to 5 large DataFrames in memory

    @staticmethod
    def read_file(file_path: str) -> pd.DataFrame:
        current_mtime = os.path.getmtime(file_path)
        
        with DataProcessor._cache_lock:
            # Check if file is in cache and has not been modified
            if file_path in DataProcessor._df_cache:
                cached_df, cached_time, cached_mtime = DataProcessor._df_cache[file_path]
                if cached_mtime == current_mtime:
                    print(f"DEBUG: Cache HIT for {file_path}")
                    # Update access time
                    DataProcessor._df_cache[file_path] = (cached_df, time.time(), cached_mtime)
                    return cached_df

        # Cache miss or modified file
        print(f"DEBUG: Cache MISS for {file_path}. Reading from disk...")
        extension = file_path.split(".")[-1].lower()
        
        # Optimization: use engine='pyarrow' for CSV if possible
        try:
            if extension == "csv":
                df = pd.read_csv(file_path, engine='pyarrow' if 'pyarrow' in str(pd.__name__) else 'c')
            elif extension in ["xls", "xlsx"]:
                df = pd.read_excel(file_path)
            elif extension == "json":
                df = pd.read_json(file_path)
            else:
                raise ValueError(f"Unsupported file extension: {extension}")
        except Exception as e:
            # Fallback for engine issues
            if extension == "csv":
                df = pd.read_csv(file_path)
            else:
                raise e

        # Clean DataFrame
        df = DataProcessor._clean_dataframe(df)

        # Store in cache
        with DataProcessor._cache_lock:
            # Simple eviction if cache is too large
            if len(DataProcessor._df_cache) >= DataProcessor._MAX_CACHE_SIZE:
                # Remove oldest accessed item
                oldest_key = min(DataProcessor._df_cache, key=lambda k: DataProcessor._df_cache[k][1])
                del DataProcessor._df_cache[oldest_key]
            
            DataProcessor._df_cache[file_path] = (df, time.time(), current_mtime)
        
        return df

    @staticmethod
    def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        # Drop columns that are completely empty (all NaN)
        df = df.dropna(axis=1, how='all')
        
        # Rename "Unnamed" columns to "Column_X"
        new_columns = []
        for i, col in enumerate(df.columns):
            col_str = str(col)
            if "Unnamed:" in col_str or col_str.strip() == "":
                new_columns.append(f"Column_{i+1}")
            else:
                new_columns.append(col_str)
        
        df.columns = new_columns
        return df

    @staticmethod
    def infer_column_types(df: pd.DataFrame) -> Dict[str, str]:
        types = {}
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                types[col] = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                types[col] = "datetime"
            else:
                # Optimization: Use sampling for expensive datetime conversion check
                sample_size = min(len(df), 100)
                sample = df[col].dropna().head(sample_size)
                
                if sample.empty:
                    types[col] = "categorical"
                    continue
                
                try:
                    # Check if sample strings look like dates before attempting full conversion
                    pd.to_datetime(sample, errors='raise')
                    # If sample passes, try full column with errors='coerce' to be safe
                    types[col] = "datetime"
                except:
                    types[col] = "categorical"
        return types

    @staticmethod
    def get_column_stats(df: pd.DataFrame, col_name: str, col_type: str) -> Dict[str, Any]:
        series = df[col_name]
        
        # Optimization: Consolidate multiple calculations into fewer passes
        null_count = int(series.isnull().sum())
        unique_count = int(series.nunique())
        
        stats = {
            "null_count": null_count,
            "unique_count": unique_count,
        }

        if col_type == "numeric":
            # Using agg for single-pass calculation of common stats
            agg_stats = series.agg(['min', 'max', 'mean', 'median', 'std']).to_dict()
            stats.update({
                "min_value": float(agg_stats['min']) if not pd.isna(agg_stats['min']) else None,
                "max_value": float(agg_stats['max']) if not pd.isna(agg_stats['max']) else None,
                "mean_value": float(agg_stats['mean']) if not pd.isna(agg_stats['mean']) else None,
                "median_value": float(agg_stats['median']) if not pd.isna(agg_stats['median']) else None,
                "std_dev": float(agg_stats['std']) if not pd.isna(agg_stats['std']) else None,
            })
        elif col_type == "categorical":
            # value_counts is already efficient, but we limit output
            top_values = series.value_counts().head(10).to_dict()
            stats["top_values"] = {str(k): int(v) for k, v in top_values.items()}
        
        return stats
