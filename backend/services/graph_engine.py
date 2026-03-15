from typing import List, Dict, Any

class GraphEngine:
    @staticmethod
    def recommend_graphs(columns: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Expects columns as a list of dicts: [{"name": str, "type": str}]
        """
        recommendations = []
        # Filter out "Column_" columns for priority lists to prefer named columns
        # but keep them available if nothing else exists
        def is_generic(name): return name.startswith("Column_")

        numeric_cols = [c["name"] for c in columns if c["type"] == "numeric"]
        categorical_cols = [c["name"] for c in columns if c["type"] == "categorical"]
        datetime_cols = [c["name"] for c in columns if c["type"] == "datetime"]
        
        # Sort columns to put non-generic ones first
        numeric_cols.sort(key=lambda x: is_generic(x))
        categorical_cols.sort(key=lambda x: is_generic(x))
        datetime_cols.sort(key=lambda x: is_generic(x))

        recommendations_plot = []
        # 1. Numeric -> Histogram
        for col in numeric_cols:
            recommendations_plot.append({
                "graph_type": "histogram",
                "x_axis": col,
                "y_axis": None,
                "aggregation": "count"
            })

        recommendations_bar_pie = []
        recommendations_donut = []
        # 2. Categorical -> Bar / Pie / Donut
        for col in categorical_cols:
            recommendations_bar_pie.append({
                "graph_type": "bar",
                "x_axis": col,
                "y_axis": None,
                "aggregation": "count"
            })
            recommendations_bar_pie.append({
                "graph_type": "pie",
                "x_axis": col,
                "y_axis": None,
                "aggregation": "count"
            })
            recommendations_donut.append({
                "graph_type": "donut",
                "x_axis": col,
                "y_axis": None,
                "aggregation": "count"
            })

        recommendations_scatter = []
        # 3. Numeric + Numeric -> Scatter
        if len(numeric_cols) >= 2:
            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    recommendations_scatter.append({
                        "graph_type": "scatter",
                        "x_axis": numeric_cols[i],
                        "y_axis": numeric_cols[j],
                        "aggregation": None
                    })

        recommendations_line = []
        # 4. Datetime + Numeric -> Line
        for dt_col in datetime_cols:
            for num_col in numeric_cols:
                recommendations_line.append({
                    "graph_type": "line",
                    "x_axis": dt_col,
                    "y_axis": num_col,
                    "aggregation": "mean"
                })

        recommendations_bar_agg = []
        # 5. Categorical + Numeric -> Bar (Aggregated)
        for cat_col in categorical_cols:
            for num_col in numeric_cols:
                recommendations_bar_agg.append({
                    "graph_type": "bar",
                    "x_axis": cat_col,
                    "y_axis": num_col,
                    "aggregation": "sum"
                })

        # Consolidate references for selection
        available_types = {
            "line": recommendations_line,
            "bar": recommendations_bar_agg if recommendations_bar_agg else [r for r in recommendations_bar_pie if r["graph_type"] == "bar"],
            "donut": recommendations_donut,
            "scatter": recommendations_scatter,
            "histogram": recommendations_plot,
            "pie": [r for r in recommendations_bar_pie if r["graph_type"] == "pie"],
        }
        
        # Selection Order (Prioritize most "insightful" types first)
        priority_order = ["line", "bar", "donut", "scatter", "histogram", "pie"]
        
        final_recommendations = []
        used_cols = set()
        
        for gtype in priority_order:
            candidates = available_types.get(gtype, [])
            if not candidates:
                continue
                
            selected = None
            # Metric 1: Find candidate with completely new columns
            for cand in candidates:
                # Extract columns used in this graph
                cols_in_graph = set()
                if cand["x_axis"]: cols_in_graph.add(cand["x_axis"])
                if cand["y_axis"]: cols_in_graph.add(cand["y_axis"])
                
                # Check intersection with used_cols
                if not cols_in_graph.intersection(used_cols):
                    selected = cand
                    break
            
            # Metric 2: If no completely new data found, just take the first valid one
            if not selected:
                selected = candidates[0]
            
            if selected:
                final_recommendations.append(selected)
                if selected["x_axis"]: used_cols.add(selected["x_axis"])
                if selected["y_axis"]: used_cols.add(selected["y_axis"])

        return final_recommendations

    @staticmethod
    def get_aggregated_data(df: Any, graph_type: str, x: str, y: str = None, aggregation: str = None) -> Dict[str, List]:
        import pandas as pd
        
        # Normalize: empty strings should be None
        if not y or (isinstance(y, str) and not y.strip()):
            y = None
        if not aggregation or (isinstance(aggregation, str) and not aggregation.strip()):
            aggregation = None

        if x not in df.columns:
            return {"labels": [], "values": []}

        # Default initialization
        labels = []
        values = []

        if graph_type in ["bar", "pie", "line", "area", "donut", "radar", "treemap", "composed", "funnel", "radialBar", "kpiCard", "heatmap", "sunburst", "boxPlot", "waterfall", "polarArea", "bubble", "bullet"]:
            # Case 1: Just X with count (histogram-like categorical distribution)
            if aggregation == "count" or not y:
                result = df[x].value_counts().head(20).reset_index()
                result.columns = [x, "count"]
                labels = [str(v) for v in result[x].tolist()]
                values = result["count"].tolist()
            # Case 2: X and Y with an aggregation method
            elif aggregation and y:
                if y not in df.columns:
                    return {"labels": [], "values": []}
                
                # Guard: if x and y are the same column name, pandas reset_index() will try
                # to create duplicate columns (cannot insert <col>, already exists).
                # In that case, treat it as a count distribution, which is well-defined.
                if x == y:
                    result = df[x].value_counts().head(20).reset_index()
                    result.columns = [x, "count"]
                    labels = [str(v) for v in result[x].tolist()]
                    values = result["count"].tolist()
                else:
                    if aggregation == "sum":
                        result = df.groupby(x)[y].sum().sort_values(ascending=False).head(20).reset_index(name=y)
                    elif aggregation == "mean":
                        result = df.groupby(x)[y].mean().sort_values(ascending=False).head(20).reset_index(name=y)
                    elif aggregation == "max":
                        result = df.groupby(x)[y].max().sort_values(ascending=False).head(20).reset_index(name=y)
                    elif aggregation == "min":
                        result = df.groupby(x)[y].min().sort_values(ascending=True).head(20).reset_index(name=y)
                    else:
                        return {"labels": [], "values": []}
                    
                    labels = [str(v) for v in result[x].tolist()]
                    values = result[y].tolist()
            # Case 3: X and Y but NO aggregation (raw data sample)
            elif y:
                if y not in df.columns:
                    return {"labels": [], "values": []}
                sample = df.head(50)
                labels = [str(v) for v in sample[x].tolist()]
                values = sample[y].tolist()
                
        elif graph_type == "scatter":
            if not y or y not in df.columns:
                return {"labels": [], "values": []}
            sample = df.head(500)
            labels = [str(v) for v in sample[x].tolist()]
            values = sample[y].tolist()
            
        elif graph_type == "histogram":
            import numpy as np
            
            # Drop NaNs and ensure numeric
            series = pd.to_numeric(df[x], errors='coerce').dropna()
            
            if not series.empty:
                # Calculate histogram
                counts, bin_edges = np.histogram(series, bins=10)
                
                values = counts.tolist()
                for i in range(len(bin_edges) - 1):
                    # Format bin label, e.g., "10-20"
                    start = round(bin_edges[i], 2)
                    end = round(bin_edges[i+1], 2)
                    labels.append(f"{start}-{end}")

        # Post-processing: Replace NaN/Infinity with None for JSON compliance
        clean_values = []
        for v in values:
            if pd.isna(v) or v == float('inf') or v == float('-inf'):
                clean_values.append(None)
            else:
                clean_values.append(v)

        return {"labels": labels, "values": clean_values}

    @staticmethod
    def parse_query(prompt: str, columns: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Parses a natural language prompt to determine graph configuration.
        """
        prompt = prompt.lower()
        col_names = [c["name"] for c in columns]
        col_types = {c["name"]: c["type"] for c in columns}

        # 1. Identify Graph Type
        graph_types = {
            "bar": ["bar", "column", "barchart"],
            "line": ["line", "trend", "over time", "series"],
            "pie": ["pie", "proportion", "distribution", "share"],
            "scatter": ["scatter", "correlation", "relationship", "versus", "vs"],
            "histogram": ["histogram", "frequency"],
            "area": ["area", "stack"]
        }
        
        detected_type = "bar" # Default
        for gtype, keywords in graph_types.items():
            if any(k in prompt for k in keywords):
                detected_type = gtype
                break

        # 2. Identify Aggregation
        aggregations = {
            "sum": ["sum", "total", "combined"],
            "mean": ["average", "mean", "avg"],
            "count": ["count", "number of", "how many"],
            "max": ["maximum", "max", "highest", "top"],
            "min": ["minimum", "min", "lowest"]
        }
        
        detected_agg = "sum" if detected_type in ["bar", "line", "pie"] else None
        for agg, keywords in aggregations.items():
            if any(k in prompt for k in keywords):
                detected_agg = agg
                break

        # 3. Identify Columns (Fuzzy Match)
        matched_cols = []
        # Sort columns by length descending to match longer names first
        sorted_cols = sorted(col_names, key=len, reverse=True)
        
        temp_prompt = prompt
        for col in sorted_cols:
            if col.lower() in temp_prompt:
                matched_cols.append(col)
                temp_prompt = temp_prompt.replace(col.lower(), "")

        # Logic for X and Y axes
        x_axis = None
        y_axis = None

        if len(matched_cols) >= 2:
            categorical = [c for c in matched_cols if col_types.get(c) == "categorical"]
            numeric = [c for c in matched_cols if col_types.get(c) == "numeric"]
            datetime = [c for c in matched_cols if col_types.get(c) == "datetime"]

            if detected_type == "line" and datetime:
                x_axis = datetime[0]
                y_axis = numeric[0] if numeric else (categorical[0] if categorical else matched_cols[1])
            elif detected_type == "scatter" and len(numeric) >= 2:
                x_axis = numeric[0]
                y_axis = numeric[1]
            elif categorical and numeric:
                x_axis = categorical[0]
                y_axis = numeric[0]
            else:
                x_axis = matched_cols[0]
                y_axis = matched_cols[1]
        elif len(matched_cols) == 1:
            x_axis = matched_cols[0]
            if detected_agg is None:
                detected_agg = "count"
        else:
            # Fallback
            categorical = [c for c in col_names if col_types.get(c) == "categorical"]
            numeric = [c for c in col_names if col_types.get(c) == "numeric"]
            if categorical:
                x_axis = categorical[0]
                if numeric:
                    y_axis = numeric[0]
            elif numeric:
                x_axis = numeric[0]

        return {
            "graph_type": detected_type,
            "x_axis": x_axis,
            "y_axis": y_axis,
            "aggregation": detected_agg
        }
